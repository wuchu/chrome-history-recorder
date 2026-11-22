/**
 * App Task Scheduler
 *
 * Owns the claim → handler → write-back loop that previously lived in the
 * extension's MV3 service worker. All storage and AI calls are in-process.
 */
import type { VFSAPI, TaskItem, TaskType, QueueStatus } from 'vfs';
import { type OllamaClient } from 'ai';
import type { ConfigStore } from './config-store';
import type { EventBus } from './event-bus';
import { type EnqueueOptions } from './media-eligibility';
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
export declare class Scheduler {
    private readonly api;
    private readonly ai;
    private readonly events;
    private readonly pollInterval;
    private readonly concurrencyByType;
    private readonly pausedByType;
    private readonly processing;
    private readonly processingCountByType;
    private running;
    private ticking;
    private intervalId;
    private handlers;
    private readonly gate;
    private readonly queueCoalescer;
    private readonly tagsCoalescer;
    constructor(dependencies: SchedulerDependencies);
    registerHandler(taskType: TaskType, handler: TaskHandler): void;
    start(): void;
    stop(): void;
    pause(): void;
    resume(): void;
    isRunning(): boolean;
    kick(): void;
    /**
     * Run one claim/dispatch cycle. Exposed for tests and manual triggers.
     */
    runOnce(): Promise<void>;
    getSchedulerStatus(): SchedulerStatus;
    updateConcurrency(taskType: string, concurrency: number): void;
    updatePaused(taskType: string, paused: boolean): void;
    private setPaused;
    private getConcurrency;
    private isTaskTypePaused;
    private processingCount;
    private beginProcessing;
    private endProcessing;
    getQueueStatus(): QueueStatus;
    enqueueTask(taskType: TaskType, hash: string, options?: EnqueueOptions): Promise<boolean>;
    enqueue(hash: string, priority?: number): Promise<boolean>;
    enqueuePair(hash: string): Promise<void>;
    requeueTask(taskType: TaskType, hash: string): Promise<{
        success: boolean;
        skipped: boolean;
        reason?: string;
    }>;
    requeueAll(taskType?: TaskType): Promise<number>;
    retryFailed(taskType?: TaskType): Promise<number>;
    clearQueue(taskType?: TaskType): Promise<void>;
    recoverStale(): Promise<number>;
    private handleClassify;
    private handleRename;
    private tick;
    private runTask;
    private markSkipped;
    private emitSkipped;
    private retryDelayFor;
    private broadcastEvent;
    private broadcastSchedulerStatus;
    private scheduleTagsSnapshot;
    private flushTagsSnapshot;
    private broadcastQueueUpdated;
    private flushQueueSnapshot;
}
export {};
//# sourceMappingURL=scheduler.d.ts.map