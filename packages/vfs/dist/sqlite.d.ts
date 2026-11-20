/**
 * VFS Service - SQLite Database Module
 *
 * Manages the SQLite index for file metadata and classification queue.
 */
/**
 * Normalize a tag candidate into a canonical vocabulary key.
 * Lowercases, strips a leading `NEW:` marker, collapses whitespace and
 * truncates overly long names.
 */
export declare function normalizeTagName(raw: string): string;
/**
 * File metadata type
 */
export interface FileMetadata {
    hash: string;
    blob_ext: string;
    mime_type: string;
    size: number;
    source_url: string | null;
    captured_at: string;
    category: string;
    ai_filename: string | null;
    tags: string | null;
    confidence: number;
    classified_at: string | null;
    model_used: string | null;
    is_starred: number;
    user_notes: string | null;
    is_deleted: number;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
}
/**
 * Classification queue item type (legacy shape, backed by `tasks`).
 */
export interface QueueItem {
    id: number;
    hash: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    priority: number;
    added_at: string;
    started_at: string | null;
    completed_at: string | null;
    error: string | null;
    retries: number;
}
/**
 * Task types supported by the unified engine. Extensible by design.
 */
export type TaskType = 'classify' | 'rename' | (string & {});
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
export interface TaskItem {
    id: number;
    task_type: TaskType;
    target_hash: string;
    status: TaskStatus;
    priority: number;
    attempts: number;
    max_attempts: number;
    next_run_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    error: string | null;
    created_at: string;
    updated_at: string;
}
export interface TaskStatusSummary {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
}
export interface QueueStatus extends TaskStatusSummary {
    byType: Record<string, TaskStatusSummary>;
}
export interface EnqueueTaskParams {
    taskType: TaskType;
    hash: string;
    priority?: number;
    maxAttempts?: number;
    /**
     * When true an existing task row is reset to pending. When false (default)
     * enqueueing is idempotent and never resurrects a completed/failed task.
     */
    requeue?: boolean;
}
export interface UpdateTaskStatusParams {
    taskType: TaskType;
    hash: string;
    status: TaskStatus;
    error?: string;
    /** Delay before a failed task becomes claimable again. */
    retryDelayMs?: number;
}
export interface TagRecord {
    id: number;
    name: string;
    label: string | null;
    usage_count: number;
    created_by: 'ai' | 'user' | string;
    is_pinned: number;
    created_at: string;
    updated_at: string;
}
export interface ApplyClassificationParams {
    hash: string;
    tags: string[];
    aliases?: Record<string, string>;
    confidence?: number;
    modelUsed?: string;
    classifiedAt?: string;
}
/**
 * List query parameters
 */
export interface ListQuery {
    category?: string;
    tag?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'captured_at' | 'category' | 'classified_at';
    order?: 'asc' | 'desc';
    includeDeleted?: boolean;
}
/**
 * Query for files indexed after a `(created_at, hash)` cursor.
 */
export interface ListFilesCreatedAfterParams {
    createdAt: string;
    hash: string;
    limit?: number;
}
/**
 * Metadata update parameters
 */
export interface MetadataUpdate {
    category?: string;
    ai_filename?: string;
    tags?: string[];
    confidence?: number;
    classified_at?: string;
    model_used?: string;
    is_starred?: boolean;
    user_notes?: string;
}
/**
 * Stats result
 */
export interface StatsResult {
    totalFiles: number;
    totalSize: number;
    images: number;
    videos: number;
    byCategory: Record<string, number>;
}
/**
 * SQLiteDatabase class
 */
export declare class SQLiteDatabase {
    private db;
    private dbPath;
    constructor(workspacePath: string);
    /**
     * Prefer WAL, but tolerate volumes where WAL is unavailable. A database
     * whose header already uses WAL cannot be opened on those volumes at all,
     * so report that case with recovery instructions instead of a bare error.
     */
    private configureJournalMode;
    /**
     * Initialize database schema
     */
    private initializeSchema;
    /**
     * Seed the vocabulary from tags already present on files (legacy user tags).
     * Runs once, when the vocabulary is still empty.
     */
    private backfillTagVocabulary;
    /**
     * Migrate the legacy `classify_queue` table into the unified `tasks` table.
     * The old table is dropped once its rows have been copied.
     */
    private migrateClassifyQueue;
    /**
     * Insert a new file record
     */
    insertFile(metadata: Omit<FileMetadata, 'created_at' | 'updated_at'>): void;
    /**
     * Get file metadata by hash
     */
    getFile(hash: string): FileMetadata | null;
    /**
     * Check if file exists by hash
     */
    fileExists(hash: string): boolean;
    /**
     * Update file metadata
     */
    updateMetadata(hash: string, updates: MetadataUpdate): boolean;
    /**
     * Soft delete file
     */
    softDeleteFile(hash: string): boolean;
    /**
     * Hard delete file (remove record)
     */
    hardDeleteFile(hash: string): boolean;
    /**
     * Restore soft-deleted file
     */
    restoreFile(hash: string): boolean;
    /**
     * List files with pagination and filters
     */
    listFiles(query: ListQuery): {
        items: FileMetadata[];
        total: number;
        hasMore: boolean;
    };
    /**
     * List files strictly after a keyset cursor, ordered by `(created_at, hash)`.
     * Used by incremental consumers such as the media archive worker.
     */
    listFilesCreatedAfter(params: ListFilesCreatedAfterParams): FileMetadata[];
    /**
     * Get tag usage counts
     */
    getTagCounts(): Record<string, number>;
    /**
     * Get statistics
     */
    getStats(): StatsResult;
    /**
     * Enqueue a typed task for a hash.
     *
     * By default enqueueing is idempotent: an existing row for the same
     * `(task_type, target_hash)` is left untouched, so captured media never
     * resurrects a task the user already refreshed or the engine already ran.
     */
    enqueueTask(params: EnqueueTaskParams): boolean;
    /**
     * Legacy classification enqueue (requeues an existing row).
     */
    enqueueClassification(hash: string, priority?: number): boolean;
    /**
     * Atomically claim up to `limit` due tasks for processing.
     */
    claimTasks(limit: number, taskTypes?: TaskType[]): TaskItem[];
    /**
     * Update a typed task's status, applying failure backoff.
     */
    updateTaskStatus(params: UpdateTaskStatusParams): boolean;
    updateTaskStatus(hash: string, status: TaskStatus, error?: string): boolean;
    /**
     * Requeue a single typed task, resetting attempts and backoff.
     *
     * Files indexed before the typed task engine may have no row for this type
     * yet, so a manual single-file refresh falls back to creating one.
     */
    requeueTask(taskType: TaskType, hash: string): boolean;
    /**
     * Requeue every task of a type (full rescan), creating rows for files that
     * never had that task type. When `taskType` is omitted all existing task
     * types are requeued.
     */
    requeueAll(taskType?: TaskType): number;
    /**
     * Recover tasks left in `processing` by a terminated service worker.
     */
    recoverStaleProcessingTasks(): number;
    /**
     * Get all task rows for a hash.
     */
    getTasksByHash(hash: string): TaskItem[];
    /**
     * Get next pending classification task (legacy).
     */
    getNextPendingTask(): QueueItem | null;
    private toQueueItem;
    /**
     * Get queue status summary, overall and per task type.
     */
    getQueueStatus(): QueueStatus;
    /**
     * Get pending classification tasks (legacy).
     */
    getPendingTasks(limit?: number): QueueItem[];
    /**
     * Get failed tasks, optionally filtered by type.
     */
    getFailedTasks(taskType?: TaskType): QueueItem[];
    /**
     * Retry failed tasks, optionally filtered by type.
     */
    retryFailedTasks(taskType?: TaskType): number;
    /**
     * Clear tasks, optionally filtered by type.
     */
    clearQueue(taskType?: TaskType): void;
    /**
     * Clear index: delete all tasks, files, and the tag vocabulary.
     */
    clearIndex(): {
        success: boolean;
    };
    /**
     * List vocabulary tags ordered by pinned state and usage.
     */
    listTags(options?: {
        limit?: number;
        pinnedOnly?: boolean;
    }): TagRecord[];
    /**
     * Get a single tag by id.
     */
    getTag(id: number): TagRecord | null;
    /**
     * Get a tag by canonical name (case-insensitive).
     */
    getTagByName(name: string): TagRecord | null;
    /**
     * Names of the most relevant tags for the classification prompt window.
     */
    getTagVocabulary(limit?: number): string[];
    /**
     * Resolve a candidate tag through the alias cache and existing vocabulary.
     * Returns the canonical tag name, or null when the candidate is unknown.
     */
    resolveTagName(candidate: string): string | null;
    /**
     * Apply a classification result: resolve/create canonical tags, record
     * aliases, replace content tags on the file (preserving `system:*`), and
     * write classification metadata. Category is intentionally never written.
     */
    applyClassification(params: ApplyClassificationParams): {
        tags: string[];
    };
    /**
     * Rename a tag, rewriting file associations and preserving the old name as
     * an alias.
     */
    renameTag(params: {
        id: number;
        name: string;
        label?: string;
    }): TagRecord;
    /**
     * Merge `sourceId` into `targetId`, reassigning files and aliases.
     */
    mergeTags(sourceId: number, targetId: number): TagRecord;
    /**
     * Delete a tag and remove it from all file tag lists.
     */
    deleteTag(id: number): boolean;
    /**
     * Toggle a tag's pinned state for Side Panel tab visibility.
     */
    setTagPinned(id: number, pinned: boolean): TagRecord | null;
    /**
     * Ensure a tag row exists, creating it with `createdBy` when missing.
     */
    private ensureTag;
    private resolveOrCreateTag;
    private replaceFileTagName;
    /**
     * Recompute `usage_count` for every vocabulary tag from file tag lists.
     */
    recomputeTagUsage(): void;
    /**
     * Close database connection
     */
    close(): void;
    /**
     * Get database path
     */
    getDbPath(): string;
}
/**
 * Ensure workspace directory exists
 */
export declare function ensureWorkspace(workspacePath: string): void;
//# sourceMappingURL=sqlite.d.ts.map