"use strict";
/**
 * VFS Service - API Handlers Module
 *
 * Implements all VFS API methods.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VFSAPI = exports.InvalidMediaError = exports.UploadEmptyError = exports.UploadTooLargeError = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const stream_1 = require("stream");
const promises_1 = require("stream/promises");
const blob_1 = require("./blob");
/**
 * Raised when a streamed upload exceeds the configured byte limit.
 */
class UploadTooLargeError extends Error {
    constructor(maxBytes) {
        super(`Upload exceeds maximum size of ${maxBytes} bytes`);
        this.name = 'UploadTooLargeError';
    }
}
exports.UploadTooLargeError = UploadTooLargeError;
/**
 * Raised when a streamed upload completes with no bytes.
 */
class UploadEmptyError extends Error {
    constructor() {
        super('Upload body is empty');
        this.name = 'UploadEmptyError';
    }
}
exports.UploadEmptyError = UploadEmptyError;
/**
 * Raised when stored bytes do not match the declared video container, which
 * usually means a partial download, an encrypted fragment, or a non-video body.
 */
class InvalidMediaError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidMediaError';
    }
}
exports.InvalidMediaError = InvalidMediaError;
/**
 * Validate the container signature of a video buffer. Non-video MIME types pass
 * through; unknown video types are accepted without a signature check.
 */
function hasValidVideoSignature(buffer, mimeType) {
    if (!mimeType.startsWith('video/'))
        return true;
    const head = buffer.subarray(0, 64);
    const ascii = head.toString('latin1');
    switch (mimeType) {
        case 'video/mp4':
        case 'video/quicktime':
            return ascii.includes('ftyp');
        case 'video/webm':
        case 'video/x-matroska':
            return head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
        case 'video/ogg':
            return ascii.startsWith('OggS');
        case 'video/x-msvideo':
            return ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'AVI ';
        default:
            return true;
    }
}
/**
 * Read the first bytes of a file for signature validation.
 */
function readFileHead(filePath, length = 64) {
    const buffer = Buffer.alloc(length);
    const fd = fs_1.default.openSync(filePath, 'r');
    try {
        const bytesRead = fs_1.default.readSync(fd, buffer, 0, length, 0);
        return buffer.subarray(0, bytesRead);
    }
    finally {
        fs_1.default.closeSync(fd);
    }
}
/**
 * VFS Service API class
 */
class VFSAPI {
    db;
    blobStorage;
    thumbnailStorage;
    workspacePath;
    ingestHook;
    constructor(db, blobStorage, thumbnailStorage, workspacePath) {
        this.db = db;
        this.blobStorage = blobStorage;
        this.thumbnailStorage = thumbnailStorage;
        this.workspacePath = workspacePath;
    }
    /**
     * Register a callback invoked after a new (non-duplicate) file is stored.
     * The app uses this to auto-enqueue AI tasks without coupling storage to
     * task policy.
     */
    setIngestHook(hook) {
        this.ingestHook = hook;
    }
    /**
     * Save file API
     */
    saveFile(params) {
        const { mimeType, sourceUrl, capturedAt } = params;
        const buffer = Buffer.isBuffer(params.buffer) ? params.buffer : Buffer.from(params.buffer);
        if (buffer.length === 0) {
            throw new Error('Cannot save empty file buffer');
        }
        const hash = (0, blob_1.calculateHash)(buffer);
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
        this.insertFileMetadata({
            hash,
            blobExt: result.ext,
            mimeType,
            size: result.size,
            sourceUrl,
            capturedAt: capturedAt || now,
        });
        const saved = {
            hash,
            duplicate: false,
            size: result.size,
            mimeType,
        };
        this.ingestHook?.(saved);
        return saved;
    }
    /**
     * Save a streamed upload. The body is written to a temporary file while its
     * SHA-256 hash is computed, then finalized into content-addressable storage.
     */
    async saveFileFromStream(params) {
        const { stream, mimeType, sourceUrl, capturedAt, maxBytes, onSizeExceeded } = params;
        const tempPath = this.blobStorage.createTempFilePath();
        const hasher = crypto_1.default.createHash('sha256');
        let size = 0;
        const meter = new stream_1.Transform({
            transform(chunk, _encoding, callback) {
                size += chunk.length;
                if (size > maxBytes) {
                    onSizeExceeded?.();
                    callback(new UploadTooLargeError(maxBytes));
                    return;
                }
                hasher.update(chunk);
                callback(null, chunk);
            },
        });
        try {
            await (0, promises_1.pipeline)(stream, meter, fs_1.default.createWriteStream(tempPath, { mode: 0o644 }));
        }
        catch (error) {
            this.blobStorage.removeTempFile(tempPath);
            throw error;
        }
        if (size === 0) {
            this.blobStorage.removeTempFile(tempPath);
            throw new UploadEmptyError();
        }
        if (!hasValidVideoSignature(readFileHead(tempPath), mimeType)) {
            this.blobStorage.removeTempFile(tempPath);
            throw new InvalidMediaError(`Video content does not match ${mimeType} (missing container signature)`);
        }
        const hash = hasher.digest('hex').substring(0, 16);
        const existing = this.db.getFile(hash);
        if (existing) {
            this.blobStorage.removeTempFile(tempPath);
            return { hash, duplicate: true, size, mimeType };
        }
        let blob;
        try {
            blob = this.blobStorage.finalizeTempFile(tempPath, hash, mimeType);
        }
        catch (error) {
            this.blobStorage.removeTempFile(tempPath);
            throw error;
        }
        this.insertFileMetadata({
            hash,
            blobExt: blob.ext,
            mimeType,
            size: blob.size,
            sourceUrl,
            capturedAt: capturedAt || new Date().toISOString(),
        });
        const saved = {
            hash,
            duplicate: false,
            size: blob.size,
            mimeType,
        };
        this.ingestHook?.(saved);
        return saved;
    }
    /**
     * Insert file metadata with the matching system tag.
     */
    insertFileMetadata(params) {
        const { hash, blobExt, mimeType, size, sourceUrl, capturedAt } = params;
        const tags = [];
        if (mimeType.startsWith('image/')) {
            tags.push('system:image');
        }
        else if (mimeType.startsWith('video/')) {
            tags.push('system:video');
        }
        this.db.insertFile({
            hash,
            blob_ext: blobExt,
            mime_type: mimeType,
            size,
            source_url: sourceUrl || null,
            captured_at: capturedAt,
            category: 'uncategorized',
            ai_filename: null,
            tags: tags.length > 0 ? JSON.stringify(tags) : null,
            confidence: 0,
            classified_at: null,
            model_used: null,
            is_starred: 0,
            user_notes: null,
            is_deleted: 0,
            deleted_at: null,
        });
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
     * List files strictly after a `(created_at, hash)` cursor.
     */
    listFilesCreatedAfter(params) {
        return this.db.listFilesCreatedAfter(params);
    }
    /**
     * Resolve a blob's absolute path without reading its contents.
     */
    getBlobPath(hash) {
        const metadata = this.db.getFile(hash);
        if (!metadata) {
            return null;
        }
        const blobPath = this.blobStorage.getBlobPath(hash, metadata.blob_ext);
        try {
            const stat = fs_1.default.statSync(blobPath);
            if (!stat.isFile()) {
                return null;
            }
            return { path: blobPath, size: stat.size, mimeType: metadata.mime_type };
        }
        catch {
            return null;
        }
    }
    /**
     * Update metadata API
     */
    updateMetadata(params) {
        const { hash, updates } = params;
        const success = this.db.updateMetadata(hash, updates);
        const updatedMetadata = success ? (this.db.getFile(hash) ?? undefined) : undefined;
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
        catch (error) {
            console.warn(`[VFSAPI] Thumbnail generation failed for ${hash}:`, error instanceof Error ? error.message : error);
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
     * Sync existing workspace blobs into the SQLite metadata index.
     */
    syncBlobsToIndex() {
        const result = {
            scanned: 0,
            indexed: 0,
            skippedExisting: 0,
            skippedUnsupported: 0,
            skippedInvalidHash: 0,
            errors: [],
        };
        let blobs;
        try {
            blobs = this.blobStorage.listBlobs();
        }
        catch (error) {
            result.errors.push({
                path: this.blobStorage.getBlobsPath(),
                reason: error instanceof Error ? error.message : 'Failed to list blobs',
            });
            return result;
        }
        for (const blob of blobs) {
            result.scanned += 1;
            const mimeType = (0, blob_1.getMimeTypeFromExtension)(blob.ext);
            if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
                result.skippedUnsupported += 1;
                continue;
            }
            try {
                const buffer = fs_1.default.readFileSync(blob.path);
                const contentHash = (0, blob_1.calculateHash)(buffer);
                if (contentHash !== blob.hash) {
                    result.skippedInvalidHash += 1;
                    continue;
                }
                if (this.db.fileExists(contentHash)) {
                    result.skippedExisting += 1;
                    continue;
                }
                const stat = fs_1.default.statSync(blob.path);
                // Add system tags
                const tags = [];
                if (mimeType.startsWith('image/')) {
                    tags.push('system:image');
                }
                else if (mimeType.startsWith('video/')) {
                    tags.push('system:video');
                }
                this.db.insertFile({
                    hash: contentHash,
                    blob_ext: blob.ext,
                    mime_type: mimeType,
                    size: blob.size,
                    source_url: null,
                    captured_at: stat.mtime.toISOString(),
                    category: 'uncategorized',
                    ai_filename: null,
                    tags: tags.length > 0 ? JSON.stringify(tags) : null,
                    confidence: 0,
                    classified_at: null,
                    model_used: null,
                    is_starred: 0,
                    user_notes: null,
                    is_deleted: 0,
                    deleted_at: null,
                });
                result.indexed += 1;
            }
            catch (error) {
                result.errors.push({
                    path: blob.path,
                    reason: error instanceof Error ? error.message : 'Failed to sync blob',
                });
            }
        }
        return result;
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
     * Enqueue classification API (legacy, requeues).
     */
    enqueueClassification(params) {
        const { hash, priority = 5 } = params;
        const success = this.db.enqueueClassification(hash, priority);
        return { success };
    }
    /**
     * Enqueue a typed task. Idempotent unless `requeue` is requested.
     */
    enqueueTask(params) {
        const success = this.db.enqueueTask(params);
        return { success };
    }
    /**
     * Atomically claim due tasks for the extension engine.
     */
    claimTasks(limit = 1, taskTypes) {
        return this.db.claimTasks(limit, taskTypes);
    }
    /**
     * Requeue a single typed task.
     */
    requeueTask(params) {
        const success = this.db.requeueTask(params.taskType, params.hash);
        return { success };
    }
    /**
     * Requeue all tasks of a type (full rescan).
     */
    requeueAll(params = {}) {
        const count = this.db.requeueAll(params.taskType);
        return { count };
    }
    /**
     * Recover tasks left processing by a terminated worker.
     */
    recoverStaleProcessingTasks() {
        const count = this.db.recoverStaleProcessingTasks();
        return { count };
    }
    /**
     * Get all tasks for a hash.
     */
    getTasksByHash(hash) {
        return this.db.getTasksByHash(hash);
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
     * Update task status API. Accepts either a typed task reference or the
     * legacy classification-only shape.
     */
    updateTaskStatus(params) {
        if ('taskType' in params) {
            this.db.updateTaskStatus(params);
        }
        else {
            this.db.updateTaskStatus(params.hash, params.status, params.error);
        }
        return { success: true };
    }
    /**
     * Retry failed tasks API
     */
    retryFailedTasks(params = {}) {
        const count = this.db.retryFailedTasks(params.taskType);
        return { count };
    }
    /**
     * Clear queue API
     */
    clearQueue(params = {}) {
        this.db.clearQueue(params.taskType);
        return { success: true };
    }
    /**
     * Apply an AI classification result, updating the tag vocabulary and file.
     */
    applyClassification(params) {
        return this.db.applyClassification(params);
    }
    /**
     * Get the bounded tag vocabulary for the classification prompt.
     */
    getTagVocabulary(params = {}) {
        return this.db.getTagVocabulary(params.limit);
    }
    /**
     * Resolve a candidate tag against the alias cache and vocabulary.
     */
    resolveTagName(params) {
        return { name: this.db.resolveTagName(params.candidate) };
    }
    /**
     * List vocabulary tags.
     */
    listTags(params = {}) {
        return this.db.listTags(params);
    }
    /**
     * Rename a tag.
     */
    renameTag(params) {
        return this.db.renameTag(params);
    }
    /**
     * Merge one tag into another.
     */
    mergeTags(params) {
        return this.db.mergeTags(params.sourceId, params.targetId);
    }
    /**
     * Delete a tag.
     */
    deleteTag(params) {
        return { success: this.db.deleteTag(params.id) };
    }
    /**
     * Pin or unpin a tag.
     */
    setTagPinned(params) {
        return this.db.setTagPinned(params.id, params.pinned);
    }
    /**
     * Get tag counts API
     */
    getTagCounts() {
        return this.db.getTagCounts();
    }
    /**
     * Clear index API
     */
    clearIndex() {
        return this.db.clearIndex();
    }
}
exports.VFSAPI = VFSAPI;
//# sourceMappingURL=api.js.map