/**
 * App Task Scheduler
 *
 * Owns the claim → handler → write-back loop that previously lived in the
 * extension's MV3 service worker. All storage and AI calls are in-process.
 */

import type { VFSAPI, TaskItem, TaskType, QueueStatus } from 'vfs';
import type { OllamaClient } from 'ai';
import type { ConfigStore } from './config-store';
import type { EventBus } from './event-bus';

export type SchedulerState = 'running' | 'paused';

export interface SchedulerStatus {
  state: SchedulerState;
  running: boolean;
  processing: number;
  concurrency: number;
}

export interface SchedulerDependencies {
  api: VFSAPI;
  ai: OllamaClient;
  config: ConfigStore;
  events: EventBus;
  pollInterval?: number;
}

type TaskHandlerResult = Record<string, unknown> | void;
type TaskHandler = (task: TaskItem) => Promise<TaskHandlerResult>;

const DEFAULT_RETRY_BASE_DELAY_MS = 5000;
const DEFAULT_RETRY_MAX_DELAY_MS = 120000;

export class Scheduler {
  private readonly api: VFSAPI;
  private readonly ai: OllamaClient;
  private readonly events: EventBus;
  private readonly pollInterval: number;
  private concurrency: number;
  private processing = new Set<string>();
  private running = false;
  private ticking = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private handlers: Map<string, TaskHandler> = new Map();

  constructor(dependencies: SchedulerDependencies) {
    this.api = dependencies.api;
    this.ai = dependencies.ai;
    this.events = dependencies.events;
    this.pollInterval = dependencies.pollInterval ?? 5000;
    this.concurrency = dependencies.config.get().classificationConcurrency;

    this.registerHandler('classify', (task) => this.handleClassify(task));
    this.registerHandler('rename', (task) => this.handleRename(task));
  }

  registerHandler(taskType: TaskType, handler: TaskHandler): void {
    this.handlers.set(taskType, handler);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.broadcastSchedulerStatus();
    void this.tick();

    this.intervalId = setInterval(() => {
      void this.tick();
    }, this.pollInterval);
  }

  stop(): void {
    if (!this.running && !this.intervalId) return;
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.broadcastSchedulerStatus();
  }

  pause(): void {
    this.stop();
  }

  resume(): void {
    this.start();
  }

  isRunning(): boolean {
    return this.running;
  }

  kick(): void {
    void this.tick();
  }

  /**
   * Run one claim/dispatch cycle. Exposed for tests and manual triggers.
   */
  async runOnce(): Promise<void> {
    await this.tick();
  }

  getSchedulerStatus(): SchedulerStatus {
    return {
      state: this.running ? 'running' : 'paused',
      running: this.running,
      processing: this.processing.size,
      concurrency: this.concurrency,
    };
  }

  updateConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, Math.floor(concurrency));
    this.broadcastSchedulerStatus();
    void this.tick();
  }

  getQueueStatus(): QueueStatus {
    return this.api.getQueueStatus();
  }

  async enqueueTask(
    taskType: TaskType,
    hash: string,
    options: { priority?: number; requeue?: boolean } = {}
  ): Promise<boolean> {
    const result = this.api.enqueueTask({
      taskType,
      hash,
      priority: options.priority ?? 5,
      requeue: options.requeue ?? false,
    });
    if (result.success) {
      this.events.emit('task:queued', {
        task_type: taskType,
        hash,
        requeue: Boolean(options.requeue),
      });
      if (taskType === 'classify') {
        this.events.emit('classify:queued', { hash });
      }
      this.broadcastQueueUpdated();
      void this.tick();
    }
    return result.success;
  }

  async enqueue(hash: string, priority: number = 5): Promise<boolean> {
    return this.enqueueTask('classify', hash, { priority });
  }

  async enqueuePair(hash: string): Promise<void> {
    await Promise.allSettled([
      this.enqueueTask('classify', hash),
      this.enqueueTask('rename', hash),
    ]);
  }

  async requeueTask(taskType: TaskType, hash: string): Promise<boolean> {
    const result = this.api.requeueTask({ taskType, hash });
    if (result.success) {
      this.events.emit('task:queued', { task_type: taskType, hash, requeue: true });
      this.broadcastQueueUpdated();
      void this.tick();
    }
    return result.success;
  }

  async requeueAll(taskType: TaskType): Promise<number> {
    const result = this.api.requeueAll({ taskType });
    this.broadcastQueueUpdated();
    if (result.count > 0) void this.tick();
    return result.count;
  }

  async retryFailed(taskType?: TaskType): Promise<number> {
    const result = this.api.retryFailedTasks({ taskType });
    this.broadcastQueueUpdated();
    if (result.count > 0) void this.tick();
    return result.count;
  }

  async clearQueue(taskType?: TaskType): Promise<void> {
    this.api.clearQueue({ taskType });
    this.broadcastQueueUpdated();
  }

  async recoverStale(): Promise<number> {
    const result = this.api.recoverStaleProcessingTasks();
    if (result.count > 0) {
      this.broadcastQueueUpdated();
    }
    return result.count;
  }

  private async handleClassify(task: TaskItem): Promise<TaskHandlerResult> {
    const result = await this.ai.classifyTagsByHash(task.target_hash);
    if (result.tags.length === 0) {
      throw new Error('AI returned no tags');
    }

    const applied = this.api.applyClassification({
      hash: task.target_hash,
      tags: result.tags,
      aliases: result.aliases,
      confidence: result.confidence,
      modelUsed: result.model,
    });

    this.events.emit('tags:updated', {
      tags: this.api.listTags({ limit: 200 }),
      counts: this.api.getTagCounts(),
    });

    return {
      tags: applied.tags,
      confidence: result.confidence,
      model_used: result.model,
    };
  }

  private async handleRename(task: TaskItem): Promise<TaskHandlerResult> {
    const result = await this.ai.renameByHash(task.target_hash);
    if (!result.suggestedName || result.suggestedName === task.target_hash) {
      throw new Error('AI returned no usable filename');
    }

    this.api.updateMetadata({
      hash: task.target_hash,
      updates: { ai_filename: result.suggestedName },
    });

    return {
      ai_filename: result.suggestedName,
      model_used: result.model,
    };
  }

  private async tick(): Promise<void> {
    if (!this.running || this.ticking) return;
    if (!this.ai.isAvailable()) return;

    const free = this.concurrency - this.processing.size;
    if (free <= 0) return;

    this.ticking = true;
    try {
      const tasks = this.api.claimTasks(free);
      for (const task of tasks) {
        const key = `${task.task_type}:${task.target_hash}`;
        if (this.processing.has(key)) continue;
        this.processing.add(key);
        this.broadcastSchedulerStatus();
        void this.runTask(task).finally(() => {
          this.processing.delete(key);
          this.broadcastSchedulerStatus();
          void this.tick();
        });
      }

      if (tasks.length > 0) {
        this.broadcastQueueUpdated();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[Scheduler] Failed to claim tasks:', message);
    } finally {
      this.ticking = false;
    }
  }

  private async runTask(task: TaskItem): Promise<void> {
    const { task_type: taskType, target_hash: hash } = task;
    const startedPayload = { task_type: taskType, hash };

    this.broadcastEvent('task:started', startedPayload);
    if (taskType === 'classify') this.broadcastEvent('classify:started', { hash });
    if (taskType === 'rename') this.broadcastEvent('rename:started', { hash });
    this.broadcastQueueUpdated();

    try {
      const handler = this.handlers.get(taskType);
      if (!handler) {
        throw new Error(`No handler registered for task type: ${taskType}`);
      }

      const result = await handler(task);
      this.api.updateTaskStatus({ taskType, hash, status: 'completed' });

      const payload = { task_type: taskType, hash, ...(result ?? {}) };
      this.broadcastEvent('task:completed', payload);
      if (taskType === 'classify') {
        this.broadcastEvent('classify:complete', payload);
        this.broadcastEvent('file:classified', payload);
      }
      if (taskType === 'rename') {
        this.broadcastEvent('rename:complete', payload);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.api.updateTaskStatus({
        taskType,
        hash,
        status: 'failed',
        error: message,
        retryDelayMs: this.retryDelayFor(task.attempts + 1),
      });

      let terminal = false;
      try {
        const rows = this.api.getTasksByHash(hash);
        terminal = rows.find((row) => row.task_type === taskType)?.status === 'failed';
      } catch {
        terminal = task.attempts + 1 >= task.max_attempts;
      }

      const payload = { task_type: taskType, hash, error: message, terminal };
      this.broadcastEvent(terminal ? 'task:failed' : 'task:retrying', payload);
      if (taskType === 'classify') this.broadcastEvent('classify:failed', payload);
      if (taskType === 'rename') this.broadcastEvent('rename:failed', payload);

      console.error(`[Scheduler] ${taskType} failed for ${hash}: ${message}`);
    } finally {
      this.broadcastQueueUpdated();
    }
  }

  private retryDelayFor(attempt: number): number {
    const delay = DEFAULT_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
    return Math.min(delay, DEFAULT_RETRY_MAX_DELAY_MS);
  }

  private broadcastEvent(type: string, data: unknown): void {
    this.events.emit(type, data);
  }

  private broadcastSchedulerStatus(): void {
    this.events.emit('classify:scheduler', this.getSchedulerStatus());
    this.events.emit('task:scheduler', this.getSchedulerStatus());
  }

  private broadcastQueueUpdated(): void {
    try {
      this.events.emit('queue:updated', {
        ...this.api.getQueueStatus(),
        scheduler: this.getSchedulerStatus(),
      });
    } catch (error) {
      console.warn('[Scheduler] Failed to broadcast queue update:', error);
    }
  }
}
