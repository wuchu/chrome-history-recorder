/**
 * Extension Background - Unified AI Task Engine
 *
 * Claims typed tasks (`classify`, `rename`, ...) from the VFS queue and runs
 * them through task-type handlers under one global concurrency limit.
 */

import { getVFSWebSocketClient, VFSTask, VFSTaskType, VFSQueueStatus } from '../vfs-ws-client';
import { getOllamaClient } from '../classify/ollama-client';
import { getFileManager } from '../file-manager';

export interface TaskEngineConfig {
  concurrency?: number;
  pollInterval?: number;
  autoStart?: boolean;
}

export type TaskEngineState = 'running' | 'paused';

export interface TaskEngineStatus {
  state: TaskEngineState;
  running: boolean;
  processing: number;
  concurrency: number;
}

type TaskHandlerResult = Record<string, unknown> | void;
type TaskHandler = (task: VFSTask) => Promise<TaskHandlerResult>;

const DEFAULT_RETRY_BASE_DELAY_MS = 5000;
const DEFAULT_RETRY_MAX_DELAY_MS = 120000;

/**
 * Unified task engine.
 */
export class TaskEngine {
  private vfsWsClient = getVFSWebSocketClient();
  private ollamaClient = getOllamaClient();
  private fileManager = getFileManager();
  private concurrency: number;
  private pollInterval: number;
  private processing: Set<string> = new Set();
  private running: boolean = false;
  private ticking: boolean = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private handlers: Map<string, TaskHandler> = new Map();

  constructor(config: TaskEngineConfig = {}) {
    this.concurrency = config.concurrency ?? 1;
    this.pollInterval = config.pollInterval ?? 5000;
    this.registerHandler('classify', (task) => this.handleClassify(task));
    this.registerHandler('rename', (task) => this.handleRename(task));
  }

  /**
   * Register a handler for a task type.
   */
  registerHandler(taskType: VFSTaskType, handler: TaskHandler): void {
    this.handlers.set(taskType, handler);
  }

  /**
   * Start processing.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.broadcastSchedulerStatus();
    void this.tick();

    this.intervalId = setInterval(() => {
      void this.tick();
    }, this.pollInterval);
  }

  /**
   * Pause processing and stop polling.
   */
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

  /**
   * Trigger a claim cycle immediately (used after wake/reconnect).
   */
  kick(): void {
    void this.tick();
  }

  getSchedulerStatus(): TaskEngineStatus {
    return {
      state: this.running ? 'running' : 'paused',
      running: this.running,
      processing: this.processing.size,
      concurrency: this.concurrency,
    };
  }

  getStatus(): TaskEngineStatus {
    return this.getSchedulerStatus();
  }

  updateConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, Math.floor(concurrency));
    this.broadcastSchedulerStatus();
    void this.tick();
  }

  async getQueueStatus(): Promise<VFSQueueStatus> {
    return this.vfsWsClient.getQueueStatus();
  }

  /**
   * Enqueue a single task idempotently.
   */
  async enqueueTask(
    taskType: VFSTaskType,
    hash: string,
    options: { priority?: number; requeue?: boolean } = {}
  ): Promise<boolean> {
    const result = await this.vfsWsClient.enqueueTask({
      taskType,
      hash,
      priority: options.priority ?? 5,
      requeue: options.requeue ?? false,
    });
    if (result.success) {
      this.fileManager.broadcastEvent('task:queued', {
        task_type: taskType,
        hash,
        requeue: Boolean(options.requeue),
      });
      if (taskType === 'classify') {
        this.fileManager.broadcastEvent('classify:queued', { hash });
      }
      await this.broadcastQueueUpdated();
      void this.tick();
    }
    return result.success;
  }

  /**
   * Legacy classification enqueue (idempotent).
   */
  async enqueue(hash: string, priority: number = 5): Promise<boolean> {
    return this.enqueueTask('classify', hash, { priority });
  }

  /**
   * Enqueue classification and rename together. Each task succeeds or fails
   * independently; neither depends on the other.
   */
  async enqueuePair(hash: string): Promise<void> {
    const results = await Promise.allSettled([
      this.enqueueTask('classify', hash),
      this.enqueueTask('rename', hash),
    ]);
    for (const result of results) {
      if (result.status === 'rejected') {
        console.warn('[TaskEngine] Failed to enqueue paired task:', result.reason);
      }
    }
  }

  /**
   * Requeue one task type for a single file (manual refresh).
   */
  async requeueTask(taskType: VFSTaskType, hash: string): Promise<boolean> {
    const result = await this.vfsWsClient.requeueTask(taskType, hash);
    if (result.success) {
      this.fileManager.broadcastEvent('task:queued', { task_type: taskType, hash, requeue: true });
      await this.broadcastQueueUpdated();
      void this.tick();
    }
    return result.success;
  }

  /**
   * Requeue every task of a type (full rescan).
   */
  async requeueAll(taskType: VFSTaskType): Promise<number> {
    const result = await this.vfsWsClient.requeueAll(taskType);
    await this.broadcastQueueUpdated();
    if (result.count > 0) {
      void this.tick();
    }
    return result.count;
  }

  /**
   * Retry failed tasks, optionally for a single type.
   */
  async retryFailed(taskType?: VFSTaskType): Promise<number> {
    const result = await this.vfsWsClient.retryFailedTasks(taskType);
    await this.broadcastQueueUpdated();
    if (result.count > 0) {
      void this.tick();
    }
    return result.count;
  }

  /**
   * Clear tasks, optionally for a single type.
   */
  async clearQueue(taskType?: VFSTaskType): Promise<void> {
    await this.vfsWsClient.clearQueue(taskType);
    await this.broadcastQueueUpdated();
  }

  /**
   * Recover tasks stranded in `processing` by a terminated worker.
   */
  async recoverStale(): Promise<number> {
    try {
      const result = await this.vfsWsClient.recoverStaleProcessingTasks();
      if (result.count > 0) {
        console.log(`[TaskEngine] Recovered ${result.count} stale processing task(s)`);
        await this.broadcastQueueUpdated();
      }
      return result.count;
    } catch (error) {
      console.warn('[TaskEngine] Failed to recover stale tasks:', error);
      return 0;
    }
  }

  private async handleClassify(task: VFSTask): Promise<TaskHandlerResult> {
    const result = await this.ollamaClient.classifyTagsByHash(task.target_hash);
    if (result.tags.length === 0) {
      throw new Error('AI returned no tags');
    }

    const applied = await this.vfsWsClient.applyClassification({
      hash: task.target_hash,
      tags: result.tags,
      aliases: result.aliases,
      confidence: result.confidence,
      modelUsed: result.model,
    });

    return {
      tags: applied.tags,
      confidence: result.confidence,
      model_used: result.model,
    };
  }

  private async handleRename(task: VFSTask): Promise<TaskHandlerResult> {
    const result = await this.ollamaClient.renameByHash(task.target_hash);
    if (!result.suggestedName || result.suggestedName === task.target_hash) {
      throw new Error('AI returned no usable filename');
    }

    await this.vfsWsClient.updateMetadata(task.target_hash, {
      ai_filename: result.suggestedName,
    });

    return {
      ai_filename: result.suggestedName,
      model_used: result.model,
    };
  }

  /**
   * Claim and dispatch due tasks up to the global concurrency limit.
   */
  private async tick(): Promise<void> {
    if (!this.running || this.ticking) return;
    if (!this.vfsWsClient.isConnected()) return;
    if (!this.ollamaClient.isAvailable()) return;

    const free = this.concurrency - this.processing.size;
    if (free <= 0) return;

    this.ticking = true;
    try {
      const tasks = await this.vfsWsClient.claimTasks(free);
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
        await this.broadcastQueueUpdated();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[TaskEngine] Failed to claim tasks:', message);
    } finally {
      this.ticking = false;
    }
  }

  private async runTask(task: VFSTask): Promise<void> {
    const { task_type: taskType, target_hash: hash } = task;
    const startedPayload = { task_type: taskType, hash };

    this.broadcastEvent('task:started', startedPayload);
    if (taskType === 'classify') this.broadcastEvent('classify:started', { hash });
    if (taskType === 'rename') this.broadcastEvent('rename:started', { hash });
    await this.broadcastQueueUpdated();

    try {
      const handler = this.handlers.get(taskType);
      if (!handler) {
        throw new Error(`No handler registered for task type: ${taskType}`);
      }

      const result = await handler(task);
      await this.vfsWsClient.updateTypedTaskStatus({
        taskType,
        hash,
        status: 'completed',
      });

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
      await this.vfsWsClient
        .updateTypedTaskStatus({
          taskType,
          hash,
          status: 'failed',
          error: message,
          retryDelayMs: this.retryDelayFor(task.attempts + 1),
        })
        .catch((updateError) => {
          console.warn('[TaskEngine] Failed to record task failure:', updateError);
        });

      // Inspect the row to distinguish a retry from a terminal failure.
      let terminal = false;
      try {
        const rows = await this.vfsWsClient.getTasksByHash(hash);
        terminal = rows.find((row) => row.task_type === taskType)?.status === 'failed';
      } catch {
        terminal = task.attempts + 1 >= task.max_attempts;
      }

      const payload = { task_type: taskType, hash, error: message, terminal };
      this.broadcastEvent(terminal ? 'task:failed' : 'task:retrying', payload);
      if (taskType === 'classify') this.broadcastEvent('classify:failed', payload);
      if (taskType === 'rename') this.broadcastEvent('rename:failed', payload);

      console.error(`[TaskEngine] ${taskType} failed for ${hash}: ${message}`);
    } finally {
      await this.broadcastQueueUpdated();
    }
  }

  private retryDelayFor(attempt: number): number {
    const delay = DEFAULT_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
    return Math.min(delay, DEFAULT_RETRY_MAX_DELAY_MS);
  }

  private broadcastEvent(type: string, data: unknown): void {
    this.fileManager.broadcastEvent(type, data);
  }

  private broadcastSchedulerStatus(): void {
    this.fileManager.broadcastEvent('classify:scheduler', this.getSchedulerStatus());
    this.fileManager.broadcastEvent('task:scheduler', this.getSchedulerStatus());
  }

  private async broadcastQueueUpdated(): Promise<void> {
    try {
      const queue = await this.getQueueStatus();
      this.fileManager.broadcastEvent('queue:updated', {
        ...queue,
        scheduler: this.getSchedulerStatus(),
      });
    } catch (error) {
      console.warn('[TaskEngine] Failed to broadcast queue update:', error);
    }
  }
}

// Singleton instance
let taskEngine: TaskEngine | null = null;

export function getTaskEngine(): TaskEngine {
  if (!taskEngine) {
    taskEngine = new TaskEngine();
  }
  return taskEngine;
}

export function getExistingTaskEngine(): TaskEngine | null {
  return taskEngine;
}

export function initTaskEngine(config?: TaskEngineConfig): TaskEngine {
  taskEngine = new TaskEngine(config);
  if (config?.autoStart) {
    taskEngine.start();
  }
  return taskEngine;
}
