/**
 * VFS Service - API Handlers Module
 *
 * Implements all VFS API methods.
 */
import { calculateHash, getExtensionFromMimeType } from './blob.js';
/**
 * VFS Service API class
 */
export class VFSAPI {
    db;
    blobStorage;
    thumbnailStorage;
    workspacePath;
    constructor(db, blobStorage, thumbnailStorage, workspacePath) {
        this.db = db;
        this.blobStorage = blobStorage;
        this.thumbnailStorage = thumbnailStorage;
        this.workspacePath = workspacePath;
    }
    /**
     * Save file API
     */
    saveFile(params) {
        const { mimeType, sourceUrl, capturedAt } = params;
        const buffer = Buffer.isBuffer(params.buffer)
            ? params.buffer
            : Buffer.from(params.buffer);
        if (buffer.length === 0) {
            throw new Error('Cannot save empty file buffer');
        }
        const hash = calculateHash(buffer);
        const ext = getExtensionFromMimeType(mimeType);
        const now = new Date().toISOString();
        // Check if file already exists
        const existing = this.db.getFile(hash);
        if (existing) {
            return {
                hash,
                duplicate: true,
                size: buffer.length,
            };
        }
        // Save blob
        const result = this.blobStorage.saveBlob(buffer, hash, mimeType);
        // Insert metadata
        this.db.insertFile({
            hash,
            blob_ext: ext,
            mime_type: mimeType,
            size: result.size,
            source_url: sourceUrl || null,
            captured_at: capturedAt || now,
            category: 'uncategorized',
            ai_filename: null,
            tags: null,
            confidence: 0,
            classified_at: null,
            model_used: null,
            is_starred: 0,
            user_notes: null,
            is_deleted: 0,
            deleted_at: null,
        });
        return {
            hash,
            duplicate: false,
            size: result.size,
        };
    }
    /**
     * Get file API
     */
    getFile(hash) {
        const metadata = this.db.getFile(hash);
        if (!metadata) {
            return null;
        }
        const buffer = this.blobStorage.readBlob(hash, metadata.blob_ext);
        if (!buffer) {
            return null;
        }
        return {
            buffer,
            mimeType: metadata.mime_type,
            size: metadata.size,
            metadata,
        };
    }
    /**
     * Delete file API
     */
    deleteFile(params) {
        const { hash, hard } = params;
        if (hard) {
            // Hard delete: remove blob and database record
            const metadata = this.db.getFile(hash);
            if (metadata) {
                this.blobStorage.deleteBlob(hash, metadata.blob_ext);
            }
            this.db.hardDeleteFile(hash);
        }
        else {
            // Soft delete: just mark as deleted
            this.db.softDeleteFile(hash);
        }
        return { success: true };
    }
    /**
     * List files API
     */
    listFiles(query) {
        return this.db.listFiles(query);
    }
    /**
     * Update metadata API
     */
    updateMetadata(params) {
        const { hash, updates } = params;
        const success = this.db.updateMetadata(hash, updates);
        const updatedMetadata = success ? this.db.getFile(hash) ?? undefined : undefined;
        return { success, updatedMetadata };
    }
    /**
     * Get metadata API
     */
    getMetadata(hash) {
        return this.db.getFile(hash);
    }
    /**
     * Get thumbnail API
     */
    async getThumbnail(params) {
        const { hash, size = 'medium' } = params;
        const metadata = this.db.getFile(hash);
        if (!metadata) {
            return null;
        }
        try {
            const buffer = await this.thumbnailStorage.generateThumbnailForBlob(hash, metadata.blob_ext, metadata.mime_type, size);
            return {
                buffer,
                mimeType: 'image/jpeg',
            };
        }
        catch {
            return null;
        }
    }
    /**
     * Get stats API
     */
    getStats() {
        return this.db.getStats();
    }
    /**
     * Get workspace config API
     */
    getWorkspaceConfig() {
        return { path: this.workspacePath };
    }
    /**
     * Set workspace config API (not supported - workspace is read-only after initialization)
     */
    setWorkspaceConfig() {
        return {
            success: false,
            error: 'Workspace path cannot be changed after initialization',
        };
    }
    /**
     * Enqueue classification API
     */
    enqueueClassification(params) {
        const { hash, priority = 5 } = params;
        const success = this.db.enqueueClassification(hash, priority);
        return { success };
    }
    /**
     * Get queue status API
     */
    getQueueStatus() {
        return this.db.getQueueStatus();
    }
    /**
     * Get pending tasks API
     */
    getPendingTasks(limit = 10) {
        const tasks = this.db.getPendingTasks(limit);
        return tasks.map((t) => ({
            hash: t.hash,
            status: t.status,
            priority: t.priority,
        }));
    }
    /**
     * Update task status API
     */
    updateTaskStatus(params) {
        const { hash, status, error } = params;
        this.db.updateTaskStatus(hash, status, error);
        return { success: true };
    }
    /**
     * Retry failed tasks API
     */
    retryFailedTasks() {
        const count = this.db.retryFailedTasks();
        return { count };
    }
    /**
     * Clear queue API
     */
    clearQueue() {
        this.db.clearQueue();
        return { success: true };
    }
    /**
     * Get tag counts API
     */
    getTagCounts() {
        const counts = this.db.getTagCounts();
        return { counts };
    }
}
//# sourceMappingURL=api.js.map