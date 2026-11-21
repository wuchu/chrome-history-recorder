/**
 * VFS Service - API Handlers Module
 *
 * Implements all VFS API methods.
 */
import { type Readable } from 'stream';
import { SQLiteDatabase, FileMetadata, MetadataUpdate, ListQuery, ListFilesResult, ListFilesCreatedAfterParams, SourceDomainCount, EnqueueTaskParams, TaskType, TaskStatus, TaskItem, QueueStatus, TagRecord, ApplyClassificationParams, RecordSkippedTaskParams, RetryFailedParams, RequeueAllParams, SkipIneligibleTasksParams } from './sqlite';
import { BlobStorage } from './blob';
import { ThumbnailStorage, ThumbnailSize } from './thumbnail';
export interface SyncBlobsToIndexError {
    path: string;
    reason: string;
}
export interface SyncBlobsToIndexResult {
    scanned: number;
    indexed: number;
    skippedExisting: number;
    skippedUnsupported: number;
    skippedInvalidHash: number;
    errors: SyncBlobsToIndexError[];
}
export interface SaveFileResult {
    hash: string;
    duplicate: boolean;
    size: number;
    mimeType?: string;
    /** True when a duplicate save restored the file from the recycle bin. */
    restored?: boolean;
    sourceUrl?: string | null;
    capturedAt?: string;
}
export interface BlobPathInfo {
    path: string;
    size: number;
    mimeType: string;
}
/**
 * Raised when a streamed upload exceeds the configured byte limit.
 */
export declare class UploadTooLargeError extends Error {
    constructor(maxBytes: number);
}
/**
 * Raised when a streamed upload completes with no bytes.
 */
export declare class UploadEmptyError extends Error {
    constructor();
}
/**
 * Raised when stored bytes do not match the declared video container, which
 * usually means a partial download, an encrypted fragment, or a non-video body.
 */
export declare class InvalidMediaError extends Error {
    constructor(message: string);
}
/**
 * VFS Service API class
 */
export declare class VFSAPI {
    private db;
    private blobStorage;
    private thumbnailStorage;
    private workspacePath;
    private ingestHook?;
    private purgeHook?;
    private restoreHook?;
    constructor(db: SQLiteDatabase, blobStorage: BlobStorage, thumbnailStorage: ThumbnailStorage, workspacePath: string);
    /**
     * Register a callback invoked after a new (non-duplicate) file is stored.
     * The app uses this to auto-enqueue AI tasks without coupling storage to
     * task policy.
     */
    setIngestHook(hook: (result: SaveFileResult) => void): void;
    /**
     * Register a callback invoked before a file row is permanently removed, so
     * the app can delete copies it owns (for example the archive target copy).
     * Hook failures are logged and never block the purge.
     */
    setPurgeHook(hook: (hash: string, metadata: FileMetadata) => void | Promise<void>): void;
    /**
     * Register a callback invoked after a file is restored from the recycle bin,
     * so the app can re-enqueue work such as archiving.
     */
    setRestoreHook(hook: (hash: string) => void | Promise<void>): void;
    private runPurgeHook;
    private runRestoreHook;
    /**
     * Save file API
     */
    saveFile(params: {
        buffer: Buffer | number[];
        mimeType: string;
        sourceUrl?: string;
        capturedAt?: string;
    }): SaveFileResult;
    /**
     * Save a streamed upload. The body is written to a temporary file while its
     * SHA-256 hash is computed, then finalized into content-addressable storage.
     */
    saveFileFromStream(params: {
        stream: Readable;
        mimeType: string;
        sourceUrl?: string;
        capturedAt?: string;
        maxBytes: number;
        onSizeExceeded?: () => void;
    }): Promise<SaveFileResult>;
    /**
     * Insert file metadata with the matching system tag.
     */
    private insertFileMetadata;
    /**
     * Get file API
     */
    getFile(hash: string): {
        buffer: Buffer;
        mimeType: string;
        size: number;
        metadata: FileMetadata;
    } | null;
    /**
     * Move a file into the recycle bin. The blob, thumbnails, and archived copy
     * are retained so the file can be restored or previewed.
     */
    trashFile(params: {
        hash: string;
    }): {
        success: boolean;
    };
    /**
     * Restore a file from the recycle bin.
     */
    restoreFile(params: {
        hash: string;
    }): Promise<{
        success: boolean;
    }>;
    /**
     * Restore every file currently in the recycle bin.
     */
    restoreAll(): Promise<{
        success: boolean;
        count: number;
    }>;
    /**
     * Permanently delete a file: thumbnails, blob, app-owned copies, tasks, and
     * the database row.
     */
    purgeFile(params: {
        hash: string;
    }): Promise<{
        success: boolean;
    }>;
    /**
     * Permanently delete every file in the recycle bin.
     */
    emptyTrash(): Promise<{
        success: boolean;
        count: number;
    }>;
    private purgeHashes;
    /**
     * List files API
     */
    listFiles(query: ListQuery): ListFilesResult;
    /**
     * Distinct source domains for the library filter.
     */
    getSourceDomains(params?: {
        limit?: number;
    }): SourceDomainCount[];
    /**
     * Whether the full-text search index is available.
     */
    isSearchIndexAvailable(): boolean;
    /**
     * List files strictly after a `(created_at, hash)` cursor.
     */
    listFilesCreatedAfter(params: ListFilesCreatedAfterParams): FileMetadata[];
    /**
     * Resolve a blob's absolute path without reading its contents.
     */
    getBlobPath(hash: string): BlobPathInfo | null;
    /**
     * Update metadata API
     */
    updateMetadata(params: {
        hash: string;
        updates: MetadataUpdate;
    }): {
        success: boolean;
        updatedMetadata?: FileMetadata;
    };
    /**
     * Get metadata API
     */
    getMetadata(hash: string): FileMetadata | null;
    /**
     * Set the star state of a file.
     */
    setFileStarred(params: {
        hash: string;
        starred: boolean;
    }): FileMetadata | null;
    /**
     * Update a file's user notes.
     */
    updateFileNotes(params: {
        hash: string;
        notes: string;
    }): FileMetadata | null;
    /**
     * Add user tags to a file.
     */
    addFileTags(params: {
        hash: string;
        tags: string[];
    }): {
        tags: string[];
    };
    /**
     * Remove user tags from a file.
     */
    removeFileTags(params: {
        hash: string;
        tags: string[];
    }): {
        tags: string[];
    };
    /**
     * Get thumbnail API
     */
    getThumbnail(params: {
        hash: string;
        size?: ThumbnailSize;
    }): Promise<{
        buffer: Buffer;
        mimeType: string;
    } | null>;
    /**
     * Get stats API
     */
    getStats(): {
        totalFiles: number;
        totalSize: number;
        images: number;
        videos: number;
        byCategory: Record<string, number>;
        trashFiles: number;
        trashSize: number;
    };
    /**
     * Get workspace config API
     */
    getWorkspaceConfig(): {
        path: string;
    };
    /**
     * Sync existing workspace blobs into the SQLite metadata index.
     */
    syncBlobsToIndex(): SyncBlobsToIndexResult;
    /**
     * Set workspace config API (not supported - workspace is read-only after initialization)
     */
    setWorkspaceConfig(): {
        success: boolean;
        error?: string;
    };
    /**
     * Enqueue classification API (legacy, requeues).
     */
    enqueueClassification(params: {
        hash: string;
        priority?: number;
    }): {
        success: boolean;
    };
    /**
     * Enqueue a typed task. Idempotent unless `requeue` is requested.
     */
    enqueueTask(params: EnqueueTaskParams): {
        success: boolean;
    };
    /**
     * Atomically claim due tasks for the extension engine.
     */
    claimTasks(limit?: number, taskTypes?: TaskType[]): TaskItem[];
    /**
     * Requeue a single typed task.
     */
    requeueTask(params: {
        taskType: TaskType;
        hash: string;
    }): {
        success: boolean;
    };
    /**
     * Requeue all tasks of a type (full rescan).
     */
    requeueAll(params?: RequeueAllParams): {
        count: number;
    };
    /**
     * Record a terminal skipped task for media the AI pipeline cannot process.
     */
    recordSkippedTask(params: RecordSkippedTaskParams): {
        success: boolean;
    };
    /**
     * Convert persisted pending/failed tasks for ineligible media to skipped.
     */
    skipIneligibleTasks(params: SkipIneligibleTasksParams): {
        count: number;
    };
    /**
     * MIME types present in the media index (used for eligibility sweeps).
     */
    getDistinctMimeTypes(): string[];
    /**
     * Image MIME types the bundled thumbnail decoder can read.
     */
    getDecodableImageMimeTypes(): string[];
    /**
     * Recover tasks left processing by a terminated worker.
     */
    recoverStaleProcessingTasks(): {
        count: number;
    };
    /**
     * Get all tasks for a hash.
     */
    getTasksByHash(hash: string): TaskItem[];
    /**
     * Get queue status API
     */
    getQueueStatus(): QueueStatus;
    /**
     * Get pending tasks API
     */
    getPendingTasks(limit?: number): Array<{
        hash: string;
        status: string;
        priority: number;
    }>;
    /**
     * Update task status API. Accepts either a typed task reference or the
     * legacy classification-only shape.
     */
    updateTaskStatus(params: {
        taskType: TaskType;
        hash: string;
        status: TaskStatus;
        error?: string;
        retryDelayMs?: number;
    } | {
        hash: string;
        status: TaskStatus;
        error?: string;
    }): {
        success: boolean;
    };
    /**
     * Retry failed tasks API. Failed tasks for ineligible media are skipped.
     */
    retryFailedTasks(params?: RetryFailedParams): {
        count: number;
    };
    /**
     * Clear queue API
     */
    clearQueue(params?: {
        taskType?: TaskType;
    }): {
        success: boolean;
    };
    /**
     * Apply an AI classification result, updating the tag vocabulary and file.
     */
    applyClassification(params: ApplyClassificationParams): {
        tags: string[];
    };
    /**
     * Get the bounded tag vocabulary for the classification prompt.
     */
    getTagVocabulary(params?: {
        limit?: number;
    }): string[];
    /**
     * Resolve a candidate tag against the alias cache and vocabulary.
     */
    resolveTagName(params: {
        candidate: string;
    }): {
        name: string | null;
    };
    /**
     * List vocabulary tags.
     */
    listTags(params?: {
        limit?: number;
        pinnedOnly?: boolean;
    }): TagRecord[];
    /**
     * Rename a tag.
     */
    renameTag(params: {
        id: number;
        name: string;
        label?: string;
    }): TagRecord;
    /**
     * Merge one tag into another.
     */
    mergeTags(params: {
        sourceId: number;
        targetId: number;
    }): TagRecord;
    /**
     * Delete a tag.
     */
    deleteTag(params: {
        id: number;
    }): {
        success: boolean;
    };
    /**
     * Pin or unpin a tag.
     */
    setTagPinned(params: {
        id: number;
        pinned: boolean;
    }): TagRecord | null;
    /**
     * Get tag counts API
     */
    getTagCounts(): Record<string, number>;
    /**
     * Clear index API
     */
    clearIndex(): {
        success: boolean;
    };
}
//# sourceMappingURL=api.d.ts.map