/**
 * Media Archive Tasks
 *
 * Copies newly captured media from the local workspace to a mounted directory
 * (for example an SMB share). Each file is represented as an `archive` task in
 * the unified task table, so it appears in the Options task console alongside
 * classify/rename, with pending/processing/completed state.
 *
 * Archive tasks are claimed by a dedicated runner rather than the AI scheduler:
 * `classificationPaused` and Ollama availability must not stop archiving.
 *
 * The destination directory is the source of truth: a file named
 * `<hash>.<ext>` with a matching size is already archived. The companion state
 * file stores the activation baseline and the enqueue-reconciliation cursor.
 */
import { type VFSAPI } from 'vfs';
import type { ConfigStore } from './config-store';
import type { EventBus } from './event-bus';
export declare const MEDIA_ARCHIVE_STATE_FILE = "media-archive-state.json";
export declare const MEDIA_ARCHIVE_STATE_VERSION = 1;
export declare const MEDIA_ARCHIVE_EVENT = "media-archive:status";
export declare const ARCHIVE_TASK_TYPE = "archive";
/**
 * Archive tasks must retry forever. The task engine treats `attempts + 1 >=
 * max_attempts` as terminal, so archive rows carry a very large budget while
 * the runner applies its own capped exponential backoff.
 */
export declare const ARCHIVE_MAX_ATTEMPTS = 1000000;
export interface MediaArchiveCursor {
    createdAt: string;
    hash: string;
}
export interface MediaArchiveState {
    version: number;
    activatedAt: string | null;
    targetPath: string;
    cursor: MediaArchiveCursor;
    /** Target changed; requeue already-enqueued tasks while reconciling. */
    requeuePending: boolean;
}
export interface MediaArchiveStatus {
    enabled: boolean;
    targetPath: string;
    intervalMinutes: number;
    running: boolean;
    lastRunAt?: string;
    pendingCount: number;
    failedCount: number;
    lastError?: string;
}
export interface MediaArchiveConfigUpdate {
    enabled?: boolean;
    targetPath?: string;
    intervalMinutes?: number;
}
export type MediaArchiveTargetErrorCode = 'invalid-path' | 'forbidden-path' | 'not-found' | 'not-a-directory' | 'not-writable' | 'volume-missing';
export declare class MediaArchiveTargetError extends Error {
    readonly code: MediaArchiveTargetErrorCode;
    constructor(code: MediaArchiveTargetErrorCode, message: string);
}
export interface ValidateMediaArchiveTargetOptions {
    workspacePath?: string;
    platform?: NodeJS.Platform;
}
export interface MediaArchiveDependencies {
    api: Pick<VFSAPI, 'listFilesCreatedAfter' | 'getMetadata' | 'getBlobPath' | 'enqueueTask' | 'claimTasks' | 'updateTaskStatus' | 'getQueueStatus'>;
    store: Pick<ConfigStore, 'get' | 'update'>;
    events: Pick<EventBus, 'emit'>;
    workspacePath: string;
    now?: () => number;
    copyFile?: (source: string, destination: string) => Promise<void>;
    pollIntervalMs?: number;
    reconcileBatchSize?: number;
    maxTasksPerDrain?: number;
    retryBaseDelayMs?: number;
    retryMaxDelayMs?: number;
    logger?: Pick<Console, 'warn' | 'error'>;
    statePath?: string;
}
/**
 * Validate a destination directory. The path must already exist; this function
 * never creates directories so an unmounted volume cannot be replaced by an
 * empty local folder.
 */
export declare function validateMediaArchiveTarget(target: string, options?: ValidateMediaArchiveTargetOptions): string;
/**
 * Tolerant state reader: a corrupt file never blocks archiving. Valid fields
 * are kept; missing or malformed ones fall back to defaults.
 */
export declare function readMediaArchiveState(statePath: string, logger?: Pick<Console, 'warn'>): MediaArchiveState;
/**
 * Persist state with an atomic temp-file rename.
 */
export declare function writeMediaArchiveState(statePath: string, state: MediaArchiveState, logger?: Pick<Console, 'warn'>): void;
export declare class MediaArchiveWorker {
    private readonly api;
    private readonly store;
    private readonly events;
    private readonly workspacePath;
    private readonly now;
    private readonly copyFile;
    private readonly pollIntervalMs;
    private readonly reconcileBatchSize;
    private readonly maxTasksPerDrain;
    private readonly retryBaseDelayMs;
    private readonly retryMaxDelayMs;
    private readonly logger;
    private readonly statePath;
    private state;
    private pollTimer;
    private reconcileTimer;
    private reconcileIntervalMs;
    private running;
    private reconciling;
    private lastRunAt?;
    private lastError?;
    private lastKnownEnabled;
    constructor(dependencies: MediaArchiveDependencies);
    /**
     * Start the runner: restore the baseline, apply a pending target change, and
     * schedule task polling plus enqueue reconciliation.
     */
    start(): void;
    stop(): void;
    /**
     * Re-read configuration, apply a target change, and reschedule timers.
     */
    reconfigure(): void;
    /**
     * Validate and persist archive settings. Rejects a target when enabling.
     */
    updateConfig(update: MediaArchiveConfigUpdate): MediaArchiveStatus;
    getStatus(): MediaArchiveStatus;
    /**
     * Enqueue an archive task for a freshly captured file.
     */
    enqueue(hash: string, requeue?: boolean): boolean;
    /**
     * Trigger reconciliation and start draining without waiting for the copies.
     * Manual triggers should return immediately; the task queue reports progress.
     */
    runNow(): MediaArchiveStatus;
    /**
     * Reconcile pending work and process a bounded number of tasks. Exposed for
     * tests and the periodic interval.
     */
    runOnce(): Promise<MediaArchiveStatus>;
    /**
     * Process due archive tasks until the queue is empty or the limit is hit.
     */
    drainTasks(limit?: number): Promise<void>;
    private kick;
    /**
     * Enqueue archive tasks for files created since the persisted cursor.
     * On a target change, `requeuePending` makes the sweep reset completed tasks
     * so the new destination receives everything since activation.
     */
    private reconcile;
    private processTask;
    private completeTask;
    private copyOne;
    /**
     * Remove the archived copy of a permanently deleted source file.
     *
     * Best-effort: a disabled archive, unavailable target, or missing copy is
     * not an error and must not block local deletion.
     */
    deleteArchived(hash: string, ext: string): void;
    private retryDelayFor;
    private ensureBaseline;
    private applyTargetChange;
    private schedule;
    private getArchiveSummary;
    private persist;
    private emitStatus;
    private emitQueueUpdated;
    private emitEvent;
}
//# sourceMappingURL=media-archive.d.ts.map