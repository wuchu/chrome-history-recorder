/**
 * VFS Service - API Handlers Module
 *
 * Implements all VFS API methods.
 */

import crypto from 'crypto';
import fs from 'fs';
import { Transform, type Readable } from 'stream';
import { pipeline } from 'stream/promises';
import {
  SQLiteDatabase,
  FileMetadata,
  MetadataUpdate,
  ListQuery,
  ListFilesResult,
  ListFilesCreatedAfterParams,
  SourceDomainCount,
  EnqueueTaskParams,
  TaskType,
  TaskStatus,
  TaskItem,
  QueueStatus,
  TagRecord,
  ApplyClassificationParams,
  RecordSkippedTaskParams,
  RetryFailedParams,
  RequeueAllParams,
  SkipIneligibleTasksParams,
} from './sqlite';
import { BlobStorage, calculateHash, getMimeTypeFromExtension } from './blob';
import {
  ThumbnailStorage,
  ThumbnailSize,
  getDecodableImageMimeTypes as readDecodableImageMimeTypes,
} from './thumbnail';

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
export class UploadTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Upload exceeds maximum size of ${maxBytes} bytes`);
    this.name = 'UploadTooLargeError';
  }
}

/**
 * Raised when a streamed upload completes with no bytes.
 */
export class UploadEmptyError extends Error {
  constructor() {
    super('Upload body is empty');
    this.name = 'UploadEmptyError';
  }
}

/**
 * Raised when stored bytes do not match the declared video container, which
 * usually means a partial download, an encrypted fragment, or a non-video body.
 */
export class InvalidMediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMediaError';
  }
}

/**
 * Validate the container signature of a video buffer. Non-video MIME types pass
 * through; unknown video types are accepted without a signature check.
 */
function hasValidVideoSignature(buffer: Buffer, mimeType: string): boolean {
  if (!mimeType.startsWith('video/')) return true;

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
function readFileHead(filePath: string, length: number = 64): Buffer {
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(filePath, 'r');
  try {
    const bytesRead = fs.readSync(fd, buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * VFS Service API class
 */
export class VFSAPI {
  private db: SQLiteDatabase;
  private blobStorage: BlobStorage;
  private thumbnailStorage: ThumbnailStorage;
  private workspacePath: string;
  private ingestHook?: (result: SaveFileResult) => void;
  private purgeHook?: (hash: string, metadata: FileMetadata) => void | Promise<void>;
  private restoreHook?: (hash: string) => void | Promise<void>;

  constructor(
    db: SQLiteDatabase,
    blobStorage: BlobStorage,
    thumbnailStorage: ThumbnailStorage,
    workspacePath: string
  ) {
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
  setIngestHook(hook: (result: SaveFileResult) => void): void {
    this.ingestHook = hook;
  }

  /**
   * Register a callback invoked before a file row is permanently removed, so
   * the app can delete copies it owns (for example the archive target copy).
   * Hook failures are logged and never block the purge.
   */
  setPurgeHook(hook: (hash: string, metadata: FileMetadata) => void | Promise<void>): void {
    this.purgeHook = hook;
  }

  /**
   * Register a callback invoked after a file is restored from the recycle bin,
   * so the app can re-enqueue work such as archiving.
   */
  setRestoreHook(hook: (hash: string) => void | Promise<void>): void {
    this.restoreHook = hook;
  }

  private async runPurgeHook(hash: string, metadata: FileMetadata): Promise<void> {
    if (!this.purgeHook) return;
    try {
      await this.purgeHook(hash, metadata);
    } catch (error) {
      console.warn(
        `[VFSAPI] Purge hook failed for ${hash}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  private async runRestoreHook(hash: string): Promise<void> {
    if (!this.restoreHook) return;
    try {
      await this.restoreHook(hash);
    } catch (error) {
      console.warn(
        `[VFSAPI] Restore hook failed for ${hash}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Save file API
   */
  saveFile(params: {
    buffer: Buffer | number[];
    mimeType: string;
    sourceUrl?: string;
    capturedAt?: string;
  }): SaveFileResult {
    const { mimeType, sourceUrl, capturedAt } = params;
    const buffer = Buffer.isBuffer(params.buffer) ? params.buffer : Buffer.from(params.buffer);
    if (buffer.length === 0) {
      throw new Error('Cannot save empty file buffer');
    }
    const hash = calculateHash(buffer);
    const now = new Date().toISOString();

    // Check if file already exists
    const existing = this.db.getFile(hash);
    if (existing) {
      if (existing.is_deleted === 1) {
        this.db.restoreFile(hash);
        const restored: SaveFileResult = {
          hash,
          duplicate: true,
          restored: true,
          size: buffer.length,
          mimeType,
          sourceUrl: sourceUrl || null,
          capturedAt,
        };
        this.ingestHook?.(restored);
        return restored;
      }
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

    const saved: SaveFileResult = {
      hash,
      duplicate: false,
      size: result.size,
      mimeType,
      sourceUrl: sourceUrl || null,
      capturedAt,
    };
    this.ingestHook?.(saved);
    return saved;
  }

  /**
   * Save a streamed upload. The body is written to a temporary file while its
   * SHA-256 hash is computed, then finalized into content-addressable storage.
   */
  async saveFileFromStream(params: {
    stream: Readable;
    mimeType: string;
    sourceUrl?: string;
    capturedAt?: string;
    maxBytes: number;
    onSizeExceeded?: () => void;
  }): Promise<SaveFileResult> {
    const { stream, mimeType, sourceUrl, capturedAt, maxBytes, onSizeExceeded } = params;
    const tempPath = this.blobStorage.createTempFilePath();
    const hasher = crypto.createHash('sha256');
    let size = 0;

    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
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
      await pipeline(stream, meter, fs.createWriteStream(tempPath, { mode: 0o644 }));
    } catch (error) {
      this.blobStorage.removeTempFile(tempPath);
      throw error;
    }

    if (size === 0) {
      this.blobStorage.removeTempFile(tempPath);
      throw new UploadEmptyError();
    }

    if (!hasValidVideoSignature(readFileHead(tempPath), mimeType)) {
      this.blobStorage.removeTempFile(tempPath);
      throw new InvalidMediaError(
        `Video content does not match ${mimeType} (missing container signature)`
      );
    }

    const hash = hasher.digest('hex').substring(0, 16);
    const existing = this.db.getFile(hash);
    if (existing) {
      this.blobStorage.removeTempFile(tempPath);
      if (existing.is_deleted === 1) {
        this.db.restoreFile(hash);
        const restored: SaveFileResult = {
          hash,
          duplicate: true,
          restored: true,
          size,
          mimeType,
          sourceUrl: sourceUrl || null,
          capturedAt,
        };
        this.ingestHook?.(restored);
        return restored;
      }
      return { hash, duplicate: true, size, mimeType };
    }

    let blob: { saved: boolean; ext: string; size: number };
    try {
      blob = this.blobStorage.finalizeTempFile(tempPath, hash, mimeType);
    } catch (error) {
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

    const saved: SaveFileResult = {
      hash,
      duplicate: false,
      size: blob.size,
      mimeType,
      sourceUrl: sourceUrl || null,
      capturedAt,
    };
    this.ingestHook?.(saved);
    return saved;
  }

  /**
   * Insert file metadata with the matching system tag.
   */
  private insertFileMetadata(params: {
    hash: string;
    blobExt: string;
    mimeType: string;
    size: number;
    sourceUrl?: string;
    capturedAt: string;
  }): void {
    const { hash, blobExt, mimeType, size, sourceUrl, capturedAt } = params;
    const tags: string[] = [];
    if (mimeType.startsWith('image/')) {
      tags.push('system:image');
    } else if (mimeType.startsWith('video/')) {
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
  getFile(
    hash: string
  ): { buffer: Buffer; mimeType: string; size: number; metadata: FileMetadata } | null {
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
   * Move a file into the recycle bin. The blob, thumbnails, and archived copy
   * are retained so the file can be restored or previewed.
   */
  trashFile(params: { hash: string }): { success: boolean } {
    return { success: this.db.softDeleteFile(params.hash) };
  }

  /**
   * Restore a file from the recycle bin.
   */
  async restoreFile(params: { hash: string }): Promise<{ success: boolean }> {
    const success = this.db.restoreFile(params.hash);
    if (success) {
      await this.runRestoreHook(params.hash);
    }
    return { success };
  }

  /**
   * Restore every file currently in the recycle bin.
   */
  async restoreAll(): Promise<{ success: boolean; count: number }> {
    const hashes = this.db.listTrashedFiles().map((file) => file.hash);
    const count = this.db.restoreAllFiles();
    for (const hash of hashes) {
      await this.runRestoreHook(hash);
    }
    return { success: true, count };
  }

  /**
   * Permanently delete a file: thumbnails, blob, app-owned copies, tasks, and
   * the database row.
   */
  async purgeFile(params: { hash: string }): Promise<{ success: boolean }> {
    await this.purgeHashes([params.hash]);
    return { success: true };
  }

  /**
   * Permanently delete every file in the recycle bin.
   */
  async emptyTrash(): Promise<{ success: boolean; count: number }> {
    const hashes = this.db.listTrashedFiles().map((file) => file.hash);
    const result = await this.purgeHashes(hashes);
    return { success: true, count: result.count };
  }

  private async purgeHashes(hashes: string[]): Promise<{ success: boolean; count: number }> {
    const metadataList = hashes
      .map((hash) => this.db.getFile(hash))
      .filter((metadata): metadata is FileMetadata => metadata !== null);

    for (const metadata of metadataList) {
      this.thumbnailStorage.deleteByHash(metadata.hash);
      try {
        this.blobStorage.deleteBlob(metadata.hash, metadata.blob_ext);
      } catch (error) {
        console.warn(
          `[VFSAPI] Failed to delete blob for ${metadata.hash}:`,
          error instanceof Error ? error.message : error
        );
      }
      await this.runPurgeHook(metadata.hash, metadata);
    }

    const count = this.db.hardDeleteFiles(metadataList.map((metadata) => metadata.hash));
    return { success: true, count };
  }

  /**
   * List files API
   */
  listFiles(query: ListQuery): ListFilesResult {
    return this.db.listFiles(query);
  }

  /**
   * Distinct source domains for the library filter.
   */
  getSourceDomains(params: { limit?: number } = {}): SourceDomainCount[] {
    return this.db.getSourceDomains(params.limit);
  }

  /**
   * Whether the full-text search index is available.
   */
  isSearchIndexAvailable(): boolean {
    return this.db.isSearchIndexAvailable();
  }

  /**
   * List files strictly after a `(created_at, hash)` cursor.
   */
  listFilesCreatedAfter(params: ListFilesCreatedAfterParams): FileMetadata[] {
    return this.db.listFilesCreatedAfter(params);
  }

  /**
   * Resolve a blob's absolute path without reading its contents.
   */
  getBlobPath(hash: string): BlobPathInfo | null {
    const metadata = this.db.getFile(hash);
    if (!metadata) {
      return null;
    }

    const blobPath = this.blobStorage.getBlobPath(hash, metadata.blob_ext);
    try {
      const stat = fs.statSync(blobPath);
      if (!stat.isFile()) {
        return null;
      }
      return { path: blobPath, size: stat.size, mimeType: metadata.mime_type };
    } catch {
      return null;
    }
  }

  /**
   * Update metadata API
   */
  updateMetadata(params: { hash: string; updates: MetadataUpdate }): {
    success: boolean;
    updatedMetadata?: FileMetadata;
  } {
    const { hash, updates } = params;
    const success = this.db.updateMetadata(hash, updates);
    const updatedMetadata = success ? (this.db.getFile(hash) ?? undefined) : undefined;
    return { success, updatedMetadata };
  }

  /**
   * Get metadata API
   */
  getMetadata(hash: string): FileMetadata | null {
    return this.db.getFile(hash);
  }

  /**
   * Set the star state of a file.
   */
  setFileStarred(params: { hash: string; starred: boolean }): FileMetadata | null {
    return this.db.setFileStarred(params.hash, params.starred);
  }

  /**
   * Update a file's user notes.
   */
  updateFileNotes(params: { hash: string; notes: string }): FileMetadata | null {
    return this.db.updateFileNotes(params.hash, params.notes);
  }

  /**
   * Add user tags to a file.
   */
  addFileTags(params: { hash: string; tags: string[] }): { tags: string[] } {
    return this.db.addFileTags(params.hash, params.tags);
  }

  /**
   * Remove user tags from a file.
   */
  removeFileTags(params: { hash: string; tags: string[] }): { tags: string[] } {
    return this.db.removeFileTags(params.hash, params.tags);
  }

  /**
   * Get thumbnail API
   */
  async getThumbnail(params: {
    hash: string;
    size?: ThumbnailSize;
  }): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const { hash, size = 'medium' } = params;
    const metadata = this.db.getFile(hash);
    if (!metadata) {
      return null;
    }

    try {
      const buffer = await this.thumbnailStorage.generateThumbnailForBlob(
        hash,
        metadata.blob_ext,
        metadata.mime_type,
        size
      );
      return {
        buffer,
        mimeType: 'image/jpeg',
      };
    } catch (error) {
      console.warn(
        `[VFSAPI] Thumbnail generation failed for ${hash}:`,
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

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
  } {
    return this.db.getStats();
  }

  /**
   * Get workspace config API
   */
  getWorkspaceConfig(): { path: string } {
    return { path: this.workspacePath };
  }

  /**
   * Sync existing workspace blobs into the SQLite metadata index.
   */
  syncBlobsToIndex(): SyncBlobsToIndexResult {
    const result: SyncBlobsToIndexResult = {
      scanned: 0,
      indexed: 0,
      skippedExisting: 0,
      skippedUnsupported: 0,
      skippedInvalidHash: 0,
      errors: [],
    };

    let blobs: Array<{ hash: string; ext: string; path: string; size: number }>;
    try {
      blobs = this.blobStorage.listBlobs();
    } catch (error) {
      result.errors.push({
        path: this.blobStorage.getBlobsPath(),
        reason: error instanceof Error ? error.message : 'Failed to list blobs',
      });
      return result;
    }

    for (const blob of blobs) {
      result.scanned += 1;

      const mimeType = getMimeTypeFromExtension(blob.ext);
      if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
        result.skippedUnsupported += 1;
        continue;
      }

      try {
        const buffer = fs.readFileSync(blob.path);
        const contentHash = calculateHash(buffer);
        if (contentHash !== blob.hash) {
          result.skippedInvalidHash += 1;
          continue;
        }

        if (this.db.fileExists(contentHash)) {
          result.skippedExisting += 1;
          continue;
        }

        const stat = fs.statSync(blob.path);
        // Add system tags
        const tags: string[] = [];
        if (mimeType.startsWith('image/')) {
          tags.push('system:image');
        } else if (mimeType.startsWith('video/')) {
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
      } catch (error) {
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
  setWorkspaceConfig(): { success: boolean; error?: string } {
    return {
      success: false,
      error: 'Workspace path cannot be changed after initialization',
    };
  }

  /**
   * Enqueue classification API (legacy, requeues).
   */
  enqueueClassification(params: { hash: string; priority?: number }): { success: boolean } {
    const { hash, priority = 5 } = params;
    const success = this.db.enqueueClassification(hash, priority);
    return { success };
  }

  /**
   * Enqueue a typed task. Idempotent unless `requeue` is requested.
   */
  enqueueTask(params: EnqueueTaskParams): { success: boolean } {
    const success = this.db.enqueueTask(params);
    return { success };
  }

  /**
   * Atomically claim due tasks for the extension engine.
   */
  claimTasks(limit: number = 1, taskTypes?: TaskType[]): TaskItem[] {
    return this.db.claimTasks(limit, taskTypes);
  }

  /**
   * Requeue a single typed task.
   */
  requeueTask(params: { taskType: TaskType; hash: string }): { success: boolean } {
    const success = this.db.requeueTask(params.taskType, params.hash);
    return { success };
  }

  /**
   * Requeue all tasks of a type (full rescan).
   */
  requeueAll(params: RequeueAllParams = {}): { count: number } {
    const count = this.db.requeueAll(params);
    return { count };
  }

  /**
   * Record a terminal skipped task for media the AI pipeline cannot process.
   */
  recordSkippedTask(params: RecordSkippedTaskParams): { success: boolean } {
    return { success: this.db.recordSkippedTask(params) };
  }

  /**
   * Convert persisted pending/failed tasks for ineligible media to skipped.
   */
  skipIneligibleTasks(params: SkipIneligibleTasksParams): { count: number } {
    return { count: this.db.skipIneligibleTasks(params) };
  }

  /**
   * MIME types present in the media index (used for eligibility sweeps).
   */
  getDistinctMimeTypes(): string[] {
    return this.db.getDistinctMimeTypes();
  }

  /**
   * Image MIME types the bundled thumbnail decoder can read.
   */
  getDecodableImageMimeTypes(): string[] {
    return readDecodableImageMimeTypes();
  }

  /**
   * Recover tasks left processing by a terminated worker.
   */
  recoverStaleProcessingTasks(): { count: number } {
    const count = this.db.recoverStaleProcessingTasks();
    return { count };
  }

  /**
   * Get all tasks for a hash.
   */
  getTasksByHash(hash: string): TaskItem[] {
    return this.db.getTasksByHash(hash);
  }

  /**
   * Get queue status API
   */
  getQueueStatus(): QueueStatus {
    return this.db.getQueueStatus();
  }

  /**
   * Get pending tasks API
   */
  getPendingTasks(limit: number = 10): Array<{ hash: string; status: string; priority: number }> {
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
  updateTaskStatus(
    params:
      | {
          taskType: TaskType;
          hash: string;
          status: TaskStatus;
          error?: string;
          retryDelayMs?: number;
        }
      | { hash: string; status: TaskStatus; error?: string }
  ): { success: boolean } {
    if ('taskType' in params) {
      this.db.updateTaskStatus(params);
    } else {
      this.db.updateTaskStatus(params.hash, params.status, params.error);
    }
    return { success: true };
  }

  /**
   * Retry failed tasks API. Failed tasks for ineligible media are skipped.
   */
  retryFailedTasks(params: RetryFailedParams = {}): { count: number } {
    const count = this.db.retryFailedTasks(params);
    return { count };
  }

  /**
   * Clear queue API
   */
  clearQueue(params: { taskType?: TaskType } = {}): { success: boolean } {
    this.db.clearQueue(params.taskType);
    return { success: true };
  }

  /**
   * Apply an AI classification result, updating the tag vocabulary and file.
   */
  applyClassification(params: ApplyClassificationParams): { tags: string[] } {
    return this.db.applyClassification(params);
  }

  /**
   * Get the bounded tag vocabulary for the classification prompt.
   */
  getTagVocabulary(params: { limit?: number } = {}): string[] {
    return this.db.getTagVocabulary(params.limit);
  }

  /**
   * Resolve a candidate tag against the alias cache and vocabulary.
   */
  resolveTagName(params: { candidate: string }): { name: string | null } {
    return { name: this.db.resolveTagName(params.candidate) };
  }

  /**
   * List vocabulary tags.
   */
  listTags(params: { limit?: number; pinnedOnly?: boolean } = {}): TagRecord[] {
    return this.db.listTags(params);
  }

  /**
   * Rename a tag.
   */
  renameTag(params: { id: number; name: string; label?: string }): TagRecord {
    return this.db.renameTag(params);
  }

  /**
   * Merge one tag into another.
   */
  mergeTags(params: { sourceId: number; targetId: number }): TagRecord {
    return this.db.mergeTags(params.sourceId, params.targetId);
  }

  /**
   * Delete a tag.
   */
  deleteTag(params: { id: number }): { success: boolean } {
    return { success: this.db.deleteTag(params.id) };
  }

  /**
   * Pin or unpin a tag.
   */
  setTagPinned(params: { id: number; pinned: boolean }): TagRecord | null {
    return this.db.setTagPinned(params.id, params.pinned);
  }

  /**
   * Get tag counts API
   */
  getTagCounts(): Record<string, number> {
    return this.db.getTagCounts();
  }

  /**
   * Clear index API
   */
  clearIndex(): { success: boolean } {
    return this.db.clearIndex();
  }
}
