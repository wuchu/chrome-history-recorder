/**
 * Extension Background - Classification Scheduler
 *
 * Manages classification task queue and processing.
 */

import { getVFSWebSocketClient, VFSQueueStatus } from '../vfs-ws-client.js';
import { getOllamaClient, ClassificationResult } from './ollama-client.js';
import { getFileManager } from '../file-manager.js';

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  concurrency?: number;
  retryDelay?: number;
  maxRetries?: number;
  autoStart?: boolean;
}

export type SchedulerState = 'running' | 'paused';

export interface SchedulerStatus {
  state: SchedulerState;
  running: boolean;
  processing: number;
  concurrency: number;
}

/**
 * Classification Scheduler class
 */
export class ClassifyScheduler {
  private vfsWsClient = getVFSWebSocketClient();
  private ollamaClient = getOllamaClient();
  private fileManager = getFileManager();
  private concurrency: number;
  private retryDelay: number;
  private maxRetries: number;
  private processing: Set<string> = new Set();
  private running: boolean = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(config: SchedulerConfig = {}) {
    this.concurrency = config.concurrency ?? 1;
    this.retryDelay = config.retryDelay ?? 5000;
    this.maxRetries = config.maxRetries ?? 3;
  }

  /**
   * Start scheduler
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    this.broadcastSchedulerStatus();

    // Process immediately
    this.processQueue();

    // Schedule periodic processing
    this.intervalId = setInterval(() => {
      this.processQueue();
    }, 5000);
  }

  /**
   * Stop scheduler
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

  /**
   * Pause scheduler processing
   */
  pause(): void {
    this.stop();
  }

  /**
   * Resume scheduler processing
   */
  resume(): void {
    this.start();
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get scheduler status
   */
  getSchedulerStatus(): SchedulerStatus {
    return {
      state: this.running ? 'running' : 'paused',
      running: this.running,
      processing: this.processing.size,
      concurrency: this.concurrency,
    };
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<VFSQueueStatus> {
    return this.vfsWsClient.getQueueStatus();
  }

  /**
   * Enqueue file for classification
   */
  async enqueue(hash: string, priority: number = 5): Promise<boolean> {
    const result = await this.vfsWsClient.enqueueClassification(hash, priority);
    if (result.success) {
      this.fileManager.broadcastEvent('classify:queued', { hash, priority });
      this.broadcastQueueUpdated();
      this.processQueue();
    }
    return result.success;
  }

  /**
   * Retry failed tasks
   */
  async retryFailed(): Promise<number> {
    const result = await this.vfsWsClient.retryFailedTasks();
    this.broadcastQueueUpdated();
    if (result.count > 0) {
      this.processQueue();
    }
    return result.count;
  }

  /**
   * Clear queue
   */
  async clearQueue(): Promise<void> {
    await this.vfsWsClient.clearQueue();
    this.broadcastQueueUpdated();
  }

  /**
   * Broadcast scheduler state
   */
  private broadcastSchedulerStatus(): void {
    this.fileManager.broadcastEvent('classify:scheduler', this.getSchedulerStatus());
  }

  /**
   * Broadcast queue update
   */
  private async broadcastQueueUpdated(): Promise<void> {
    try {
      const queue = await this.getQueueStatus();
      this.fileManager.broadcastEvent('queue:updated', {
        ...queue,
        scheduler: this.getSchedulerStatus(),
      });
    } catch (error) {
      console.warn('[ClassifyScheduler] Failed to broadcast queue update:', error);
    }
  }

  /**
   * Process pending tasks
   */
  private async processQueue(): Promise<void> {
    if (!this.running) return;
    if (!this.ollamaClient.isAvailable()) return;

    // Get pending tasks
    const pendingTasks = await this.vfsWsClient.getPendingTasks(this.concurrency * 2);

    // Process tasks up to concurrency limit
    for (const task of pendingTasks) {
      if (this.processing.size >= this.concurrency) break;
      if (this.processing.has(task.hash)) continue;

      this.processing.add(task.hash);
      this.processTask(task.hash).finally(() => {
        this.processing.delete(task.hash);
      });
    }
  }

  /**
   * Process single task
   */
  private async processTask(hash: string): Promise<void> {
    try {
      // Update status to processing
      await this.vfsWsClient.updateTaskStatus(hash, 'processing');
      this.fileManager.broadcastEvent('classify:started', { hash });
      await this.broadcastQueueUpdated();

      // Classify
      const result = await this.ollamaClient.classifyByHash(hash);

      // Update status to completed
      await this.vfsWsClient.updateTaskStatus(hash, 'completed');

      const classifiedAt = new Date().toISOString();
      const modelUsed = this.ollamaClient.getConfig().model;

      // Broadcast event
      this.fileManager.broadcastEvent('classify:complete', {
        hash,
        category: result.category,
        ai_filename: result.suggestedName,
        confidence: result.confidence,
        tags: result.tags,
        classified_at: classifiedAt,
        model_used: modelUsed,
      });
      this.fileManager.broadcastEvent('file:classified', {
        hash,
        category: result.category,
        ai_filename: result.suggestedName,
        confidence: result.confidence,
        tags: result.tags,
        classified_at: classifiedAt,
        model_used: modelUsed,
      });
      await this.broadcastQueueUpdated();

      console.log(`[ClassifyScheduler] Completed: ${hash} -> ${result.category}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Update status to failed
      await this.vfsWsClient.updateTaskStatus(hash, 'failed', message);
      this.fileManager.broadcastEvent('classify:failed', { hash, error: message });
      await this.broadcastQueueUpdated();

      console.error(`[ClassifyScheduler] Failed: ${hash} - ${message}`);
    }
  }

  /**
   * Update concurrency
   */
  updateConcurrency(concurrency: number): void {
    this.concurrency = concurrency;
  }
}

// Singleton instance
let classifyScheduler: ClassifyScheduler | null = null;

/**
 * Get Classification Scheduler singleton
 */
export function getClassifyScheduler(): ClassifyScheduler {
  if (!classifyScheduler) {
    classifyScheduler = new ClassifyScheduler();
  }
  return classifyScheduler;
}

/**
 * Get existing Classification Scheduler singleton without creating one
 */
export function getExistingClassifyScheduler(): ClassifyScheduler | null {
  return classifyScheduler;
}

/**
 * Initialize Classification Scheduler
 */
export function initClassifyScheduler(config?: SchedulerConfig): ClassifyScheduler {
  classifyScheduler = new ClassifyScheduler(config);
  if (config?.autoStart ?? true) {
    classifyScheduler.start();
  }
  return classifyScheduler;
}