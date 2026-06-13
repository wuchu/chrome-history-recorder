/**
 * VFS Service - API Handlers Module
 *
 * Implements all VFS API methods.
 */

import { SQLiteDatabase, FileMetadata, MetadataUpdate, ListQuery } from './sqlite.js';
import { BlobStorage, calculateHash, getExtensionFromMimeType } from './blob.js';
import { ThumbnailStorage, ThumbnailSize } from './thumbnail.js';

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
  getFile(hash: string): { buffer: Buffer; mimeType: string; size: number; metadata: FileMetadata } | null {
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
  updateMetadata(params: { hash: string; updates: MetadataUpdate }): { success: boolean; updatedMetadata?: FileMetadata } {
    const { hash, updates } = params;
    const success = this.db.updateMetadata(hash, updates);
    const updatedMetadata = success ? this.db.getFile(hash) ?? undefined : undefined;
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
  async getThumbnail(params: { hash: string; size?: ThumbnailSize }): Promise<{ buffer: Buffer; mimeType: string } | null> {
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
  getStats(): { totalFiles: number; totalSize: number; images: number; videos: number; byCategory: Record<string, number> } {
    return this.db.getStats();
  }

  /**
   * Get workspace config API
   */
  getWorkspaceConfig(): { path: string } {
    return { path: this.workspacePath };
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
   * Enqueue classification API
   */
  enqueueClassification(params: { hash: string; priority?: number }): { success: boolean } {
    const { hash, priority = 5 } = params;
    const success = this.db.enqueueClassification(hash, priority);
    return { success };
  }

  /**
   * Get queue status API
   */
  getQueueStatus(): { pending: number; processing: number; completed: number; failed: number; total: number } {
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
   * Update task status API
   */
  updateTaskStatus(params: {
    hash: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error?: string;
  }): { success: boolean } {
    const { hash, status, error } = params;
    this.db.updateTaskStatus(hash, status, error);
    return { success: true };
  }

  /**
   * Retry failed tasks API
   */
  retryFailedTasks(): { count: number } {
    const count = this.db.retryFailedTasks();
    return { count };
  }

  /**
   * Clear queue API
   */
  clearQueue(): { success: boolean } {
    this.db.clearQueue();
    return { success: true };
  }

  /**
   * Get tag counts API
   */
  getTagCounts(): { counts: Record<string, number> } {
    const counts = this.db.getTagCounts();
    return { counts };
  }
}