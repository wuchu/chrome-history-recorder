/**
 * App Task Scheduler
 *
 * Owns the claim → handler → write-back loop that previously lived in the
 * extension's MV3 service worker. All storage and AI calls are in-process.
 */

import type { VFSAPI, TaskItem, TaskType, QueueStatus } from 'vfs';
import { isUnprocessableMediaError, type OllamaClient } from 'ai';
import type { ConfigStore } from './config-store';
import type { EventBus } from './event-bus';
import { EventCoalescer } from './event-coalescer';
import { MediaEligibilityGate, type EnqueueOptions } from './media-eligibility';

export type SchedulerState = 'running' | 'paused';

export interface SchedulerTaskTypeStatus {
  state: SchedulerState;
  processing: number;
  concurrency: number;
}

export interface SchedulerStatus {
  state: SchedulerState;
  running: boolean;
  processing: number;
  byType: Record<string, SchedulerTaskTypeStatus>;
}

export interface SchedulerDependencies {
  api: VFSAPI;
  ai: OllamaClient;
  config: ConfigStore;
  events: EventBus;
  pollInterval?: number;
  coalesceWindowMs?: number;
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
  private readonly concurrencyByType = new Map<string, number>();
  private readonly pausedByType = new Map<string, boolean>();
  private readonly processing = new Set<string>();
  private readonly processingCountByType = new Map<string, number>();
  private running = false;
  private ticking = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private handlers: Map<string, TaskHandler> = new Map();
  private readonly gate: MediaEligibilityGate;
  private readonly queueCoalescer: EventCoalescer;
  private readonly tagsCoalescer: EventCoalescer;

  constructor(dependencies: SchedulerDependencies) {
    this.api = dependencies.api;
    this.ai = dependencies.ai;
    this.events = dependencies.events;
    this.pollInterval = dependencies.pollInterval ?? 5000;
    const config = dependencies.config.get();
    this.concurrencyByType.set('classify', config.classifyConcurrency);
    this.concurrencyByType.set('rename', config.renameConcurrency);
    this.pausedByType.set('classify', config.classifyPaused);
    this.pausedByType.set('rename', config.renamePaused);
    this.gate = new MediaEligibilityGate(this.api);
    const coalesceWindowMs = dependencies.coalesceWindowMs ?? 250;
    this.queueCoalescer = new EventCoalescer(() => this.flushQueueSnapshot(), coalesceWindowMs);
    this.tagsCoalescer = new EventCoalescer(() => this.flushTagsSnapshot(), coalesceWindowMs);

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
    this.queueCoalescer.cancel();
    this.tagsCoalescer.cancel();
    if (!this.running && !this.intervalId) return;
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.broadcastSchedulerStatus();
  }

  pause(): void {
    for (const taskType of this.handlers.keys()) {
      this.setPaused(taskType, true);
    }
  }

  resume(): void {
    for (const taskType of this.handlers.keys()) {
      this.setPaused(taskType, false);
    }
  }

  isRunning(): boolean {
    return this.getSchedulerStatus().running;
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
    const byType: Record<string, SchedulerTaskTypeStatus> = {};
    let anyRunning = false;
    let processing = 0;

    for (const taskType of this.handlers.keys()) {
      const state: SchedulerState = this.isTaskTypePaused(taskType) ? 'paused' : 'running';
      const typeProcessing = this.processingCount(taskType);
      processing += typeProcessing;
      byType[taskType] = {
        state,
        processing: typeProcessing,
        concurrency: this.getConcurrency(taskType),
      };
      if (state === 'running') anyRunning = true;
    }

    return {
      state: anyRunning ? 'running' : 'paused',
      running: anyRunning,
      processing,
      byType,
    };
  }

  updateConcurrency(taskType: string, concurrency: number): void {
    this.concurrencyByType.set(taskType, Math.max(1, Math.floor(concurrency)));
    this.broadcastSchedulerStatus();
    void this.tick();
  }

  updatePaused(taskType: string, paused: boolean): void {
    this.setPaused(taskType, paused);
  }

  private setPaused(taskType: string, paused: boolean): void {
    this.pausedByType.set(taskType, paused);
    this.broadcastSchedulerStatus();
    if (!paused) {
      void this.tick();
    }
  }

  private getConcurrency(taskType: string): number {
    return this.concurrencyByType.get(taskType) ?? 1;
  }

  private isTaskTypePaused(taskType: string): boolean {
    return this.pausedByType.get(taskType) === true;
  }

  private processingCount(taskType: string): number {
    return this.processingCountByType.get(taskType) ?? 0;
  }

  private beginProcessing(taskType: string, hash: string): boolean {
    const key = `${taskType}:${hash}`;
    if (this.processing.has(key)) return false;
    this.processing.add(key);
    this.processingCountByType.set(taskType, this.processingCount(taskType) + 1);
    return true;
  }

  private endProcessing(taskType: string, hash: string): void {
    const key = `${taskType}:${hash}`;
    if (!this.processing.delete(key)) return;
    this.processingCountByType.set(taskType, Math.max(0, this.processingCount(taskType) - 1));
  }

  getQueueStatus(): QueueStatus {
    return this.api.getQueueStatus();
  }

  async enqueueTask(
    taskType: TaskType,
    hash: string,
    options: EnqueueOptions = {}
  ): Promise<boolean> {
    const result = this.gate.enqueue(taskType, hash, {
      priority: options.priority ?? 5,
      maxAttempts: options.maxAttempts,
      requeue: options.requeue ?? false,
    });

    if (result.skipped) {
      // Ineligible media never enters the pending queue; surface the terminal
      // outcome so the UI can explain why no AI work will run.
      this.emitSkipped(taskType, hash, result.reason ?? 'Media is not processable');
      this.broadcastQueueUpdated();
      return result.success;
    }

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

  async requeueTask(
    taskType: TaskType,
    hash: string
  ): Promise<{ success: boolean; skipped: boolean; reason?: string }> {
    const reason = this.gate.ineligibleReason(hash);
    if (reason) {
      const success = this.markSkipped(taskType, hash, reason);
      return { success: false, skipped: success, reason };
    }

    const result = this.api.requeueTask({ taskType, hash });
    if (result.success) {
      this.events.emit('task:queued', { task_type: taskType, hash, requeue: true });
      this.broadcastQueueUpdated();
      void this.tick();
    }
    return { success: result.success, skipped: false };
  }

  async requeueAll(taskType?: TaskType): Promise<number> {
    const result = this.api.requeueAll({
      taskType,
      ineligibleMimeTypes: this.gate.ineligibleMimeTypes(),
    });
    this.broadcastQueueUpdated();
    if (result.count > 0) void this.tick();
    return result.count;
  }

  async retryFailed(taskType?: TaskType): Promise<number> {
    const result = this.api.retryFailedTasks({
      taskType,
      ineligibleMimeTypes: this.gate.ineligibleMimeTypes(),
    });
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

    this.scheduleTagsSnapshot();

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

    this.ticking = true;
    try {
      // Only claim task types this scheduler owns. The media archive runner
      // claims its own `archive` tasks so AI pause/Ollama availability cannot
      // block archiving.
      let claimedAny = false;

      for (const taskType of this.handlers.keys()) {
        if (this.isTaskTypePaused(taskType)) continue;

        const free = this.getConcurrency(taskType) - this.processingCount(taskType);
        if (free <= 0) continue;

        const tasks = this.api.claimTasks(free, [taskType as TaskType]);
        if (tasks.length === 0) continue;
        claimedAny = true;

        for (const task of tasks) {
          const hash = task.target_hash;
          if (!this.beginProcessing(taskType, hash)) continue;
          void this.runTask(task).finally(() => {
            this.endProcessing(taskType, hash);
            void this.tick();
          });
        }
      }

      if (claimedAny) {
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

      if (isUnprocessableMediaError(error)) {
        // Permanent: the media cannot produce a representative image. Mark it
        // skipped once; retrying the same bytes can never succeed.
        this.api.updateTaskStatus({ taskType, hash, status: 'skipped', error: message });
        this.emitSkipped(taskType, hash, message);
        console.warn(`[Scheduler] ${taskType} skipped for ${hash}: ${message}`);
        return;
      }

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

  private markSkipped(taskType: TaskType, hash: string, reason: string): boolean {
    const recorded = this.api.recordSkippedTask({ taskType, hash, error: reason });
    if (recorded.success) {
      this.emitSkipped(taskType, hash, reason);
      this.broadcastQueueUpdated();
    }
    return recorded.success;
  }

  private emitSkipped(taskType: TaskType, hash: string, reason: string): void {
    const payload = { task_type: taskType, hash, error: reason, terminal: true };
    this.broadcastEvent('task:skipped', payload);
    if (taskType === 'classify') this.broadcastEvent('classify:skipped', payload);
    if (taskType === 'rename') this.broadcastEvent('rename:skipped', payload);
  }

  private retryDelayFor(attempt: number): number {
    const delay = DEFAULT_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
    return Math.min(delay, DEFAULT_RETRY_MAX_DELAY_MS);
  }

  private broadcastEvent(type: string, data: unknown): void {
    this.events.emit(type, data);
  }

  private broadcastSchedulerStatus(): void {
    const status = this.getSchedulerStatus();
    this.events.emit('task:scheduler', status);
    this.events.emit('classify:scheduler', status);
  }

  private scheduleTagsSnapshot(): void {
    this.tagsCoalescer.schedule();
  }

  private flushTagsSnapshot(): void {
    try {
      this.events.emit('tags:updated', {
        tags: this.api.listTags({ limit: 200 }),
        counts: this.api.getTagCounts(),
      });
    } catch (error) {
      console.warn('[Scheduler] Failed to broadcast tag update:', error);
    }
  }

  private broadcastQueueUpdated(): void {
    this.queueCoalescer.schedule();
  }

  private flushQueueSnapshot(): void {
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
