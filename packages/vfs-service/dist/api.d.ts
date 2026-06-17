/**
 * VFS Service - API Handlers Module
 *
 * Implements all VFS API methods.
 */
import { SQLiteDatabase, FileMetadata, MetadataUpdate, ListQuery } from './sqlite';
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
/**
 * VFS Service API class
 */
export declare class VFSAPI {
    private db;
    private blobStorage;
    private thumbnailStorage;
    private workspacePath;
    constructor(db: SQLiteDatabase, blobStorage: BlobStorage, thumbnailStorage: ThumbnailStorage, workspacePath: string);
    /**
     * Save file API
     */
    saveFile(params: {
        buffer: Buffer | number[];
        mimeType: string;
        sourceUrl?: string;
        capturedAt?: string;
    }): {
        hash: string;
        duplicate: boolean;
        size: number;
    };
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
     * Enqueue classification API
     */
    enqueueClassification(params: {
        hash: string;
        priority?: number;
    }): {
        success: boolean;
    };
    /**
     * Get queue status API
     */
    getQueueStatus(): {
        pending: number;
        processing: number;
        completed: number;
        failed: number;
        total: number;
    };
    /**
     * Get pending tasks API
     */
    getPendingTasks(limit?: number): Array<{
        hash: string;
        status: string;
        priority: number;
    }>;
    /**
     * Update task status API
     */
    updateTaskStatus(params: {
        hash: string;
        status: 'pending' | 'processing' | 'completed' | 'failed';
        error?: string;
    }): {
        success: boolean;
    };
    /**
     * Retry failed tasks API
     */
    retryFailedTasks(): {
        count: number;
    };
    /**
     * Clear queue API
     */
    clearQueue(): {
        success: boolean;
    };
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