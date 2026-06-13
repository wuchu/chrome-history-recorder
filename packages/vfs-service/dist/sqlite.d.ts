/**
 * VFS Service - SQLite Database Module
 *
 * Manages the SQLite index for file metadata and classification queue.
 */
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
 * Classification queue item type
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
 * Queue status summary
 */
export interface QueueStatus {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
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
     * Initialize database schema
     */
    private initializeSchema;
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
     * Get tag usage counts
     */
    getTagCounts(): Record<string, number>;
    /**
     * Get statistics
     */
    getStats(): StatsResult;
    /**
     * Enqueue classification task
     */
    enqueueClassification(hash: string, priority?: number): boolean;
    /**
     * Get next pending task
     */
    getNextPendingTask(): QueueItem | null;
    /**
     * Update task status
     */
    updateTaskStatus(hash: string, status: 'pending' | 'processing' | 'completed' | 'failed', error?: string): boolean;
    /**
     * Get queue status summary
     */
    getQueueStatus(): QueueStatus;
    /**
     * Get pending tasks (for scheduler)
     */
    getPendingTasks(limit?: number): QueueItem[];
    /**
     * Get failed tasks
     */
    getFailedTasks(): QueueItem[];
    /**
     * Retry failed tasks
     */
    retryFailedTasks(): number;
    /**
     * Clear queue
     */
    clearQueue(): void;
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
 * Get default workspace path
 */
export declare function getDefaultWorkspacePath(): string;
/**
 * Ensure workspace directory exists
 */
export declare function ensureWorkspace(workspacePath: string): void;
//# sourceMappingURL=sqlite.d.ts.map