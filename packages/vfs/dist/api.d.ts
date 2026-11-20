/**
 * VFS Service - API Handlers Module
 *
 * Implements all VFS API methods.
 */
import { type Readable } from 'stream';
import { SQLiteDatabase, FileMetadata, MetadataUpdate, ListQuery, ListFilesCreatedAfterParams, EnqueueTaskParams, TaskType, TaskStatus, TaskItem, QueueStatus, TagRecord, ApplyClassificationParams } from './sqlite';
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
    constructor(db: SQLiteDatabase, blobStorage: BlobStorage, thumbnailStorage: ThumbnailStorage, workspacePath: string);
    /**
     * Register a callback invoked after a new (non-duplicate) file is stored.
     * The app uses this to auto-enqueue AI tasks without coupling storage to
     * task policy.
     */
    setIngestHook(hook: (result: SaveFileResult) => void): void;
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
     * Delete file API
     */
    deleteFile(params: {
        hash: string;
        hard?: boolean;
    }): {
        success: boolean;
    };
    /**
     * List files API
     */
    listFiles(query: ListQuery): {
        items: FileMetadata[];
        total: number;
        hasMore: boolean;
    };
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
    requeueAll(params?: {
        taskType?: TaskType;
    }): {
        count: number;
    };
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
     * Retry failed tasks API
     */
    retryFailedTasks(params?: {
        taskType?: TaskType;
    }): {
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