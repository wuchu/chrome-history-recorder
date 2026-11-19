/**
 * VFS Service - API Handlers Module
 *
 * Implements all VFS API methods.
 */

import fs from 'fs';
import {
  SQLiteDatabase,
  FileMetadata,
  MetadataUpdate,
  ListQuery,
  EnqueueTaskParams,
  TaskType,
  TaskStatus,
  TaskItem,
  QueueStatus,
  TagRecord,
  ApplyClassificationParams,
} from './sqlite';
import {
  BlobStorage,
  calculateHash,
  getExtensionFromMimeType,
  getMimeTypeFromExtension,
} from './blob';
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
export class VFSAPI {
  private db: SQLiteDatabase;
  private blobStorage: BlobStorage;
  private thumbnailStorage: ThumbnailStorage;
  private workspacePath: string;

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
   * Save file API
   */
  saveFile(params: {
    buffer: Buffer | number[];
    mimeType: string;
    sourceUrl?: string;
    capturedAt?: string;
  }): { hash: string; duplicate: boolean; size: number } {
    const { mimeType, sourceUrl, capturedAt } = params;
    const buffer = Buffer.isBuffer(params.buffer) ? params.buffer : Buffer.from(params.buffer);
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

    // Insert metadata with system tags
    const tags: string[] = [];
    if (mimeType.startsWith('image/')) {
      tags.push('system:image');
    } else if (mimeType.startsWith('video/')) {
      tags.push('system:video');
    }
    this.db.insertFile({
      hash,
      blob_ext: ext,
      mime_type: mimeType,
      size: result.size,
      source_url: sourceUrl || null,
      captured_at: capturedAt || now,
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

    return {
      hash,
      duplicate: false,
      size: result.size,
    };
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
   * Delete file API
   */
  deleteFile(params: { hash: string; hard?: boolean }): { success: boolean } {
    const { hash, hard } = params;

    if (hard) {
      // Hard delete: remove blob and database record
      const metadata = this.db.getFile(hash);
      if (metadata) {
        this.blobStorage.deleteBlob(hash, metadata.blob_ext);
      }
      this.db.hardDeleteFile(hash);
    } else {
      // Soft delete: just mark as deleted
      this.db.softDeleteFile(hash);
    }

    return { success: true };
  }

  /**
   * List files API
   */
  listFiles(query: ListQuery): { items: FileMetadata[]; total: number; hasMore: boolean } {
    return this.db.listFiles(query);
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
    } catch {
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
  claimTasks(limit: number = 1): TaskItem[] {
    return this.db.claimTasks(limit);
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
  requeueAll(params: { taskType?: TaskType } = {}): { count: number } {
    const count = this.db.requeueAll(params.taskType);
    return { count };
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
   * Retry failed tasks API
   */
  retryFailedTasks(params: { taskType?: TaskType } = {}): { count: number } {
    const count = this.db.retryFailedTasks(params.taskType);
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
