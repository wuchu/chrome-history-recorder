/**
 * VFS Service - API Handler Tests
 *
 * Tests for all VFS API methods including file operations, metadata, queue, and stats.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VFSAPI } from '../src/api.js';
import { SQLiteDatabase, ensureWorkspace } from '../src/sqlite.js';
import { BlobStorage, calculateHash } from '../src/blob.js';
import { ThumbnailStorage } from '../src/thumbnail.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('VFSAPI', () => {
  let api: VFSAPI;
  let db: SQLiteDatabase;
  let blobStorage: BlobStorage;
  let thumbnailStorage: ThumbnailStorage;
  let testWorkspace: string;

  beforeEach(() => {
    testWorkspace = path.join(os.tmpdir(), `vfs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    ensureWorkspace(testWorkspace);
    db = new SQLiteDatabase(testWorkspace);
    blobStorage = new BlobStorage(testWorkspace);
    thumbnailStorage = new ThumbnailStorage(testWorkspace);
    api = new VFSAPI(db, blobStorage, thumbnailStorage, testWorkspace);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // Database may not be initialized if test failed early
    }
    if (fs.existsSync(testWorkspace)) {
      try {
        fs.rmSync(testWorkspace, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('saveFile API', () => {
    it('should save new file and return hash', () => {
      const buffer = Buffer.from('test image content');
      const result = api.saveFile({
        buffer,
        mimeType: 'image/jpeg',
        sourceUrl: 'https://example.com/image.jpg',
        capturedAt: '2024-01-01T00:00:00.000Z',
      });

      expect(result.hash).toBeDefined();
      expect(result.hash.length).toBe(16);
      expect(result.duplicate).toBe(false);
      expect(result.size).toBe(buffer.length);
    });

    it('should detect duplicate file', () => {
      const buffer = Buffer.from('duplicate content');
      const result1 = api.saveFile({
        buffer,
        mimeType: 'image/jpeg',
      });

      const result2 = api.saveFile({
        buffer,
        mimeType: 'image/jpeg',
      });

      expect(result1.hash).toBe(result2.hash);
      expect(result1.duplicate).toBe(false);
      expect(result2.duplicate).toBe(true);
    });

    it('should save blob to storage', () => {
      const buffer = Buffer.from('test');
      const result = api.saveFile({
        buffer,
        mimeType: 'image/png',
      });

      expect(blobStorage.blobExists(result.hash, 'png')).toBe(true);
    });

    it('should insert metadata to database', () => {
      const buffer = Buffer.from('test');
      const result = api.saveFile({
        buffer,
        mimeType: 'image/jpeg',
        sourceUrl: 'https://example.com',
      });

      const metadata = db.getFile(result.hash);
      expect(metadata).toBeDefined();
      expect(metadata?.mime_type).toBe('image/jpeg');
      expect(metadata?.source_url).toBe('https://example.com');
      expect(metadata?.category).toBe('uncategorized');
    });

    it('should use default capturedAt if not provided', () => {
      const buffer = Buffer.from('test');
      const result = api.saveFile({
        buffer,
        mimeType: 'image/jpeg',
      });

      const metadata = db.getFile(result.hash);
      expect(metadata?.captured_at).toBeDefined();
      const capturedDate = new Date(metadata!.captured_at);
      expect(capturedDate.getTime()).toBeLessThan(Date.now() + 1000);
    });
  });

  describe('getFile API', () => {
    it('should get file with buffer and metadata', () => {
      const buffer = Buffer.from('test content');
      const saveResult = api.saveFile({
        buffer,
        mimeType: 'image/jpeg',
      });

      const result = api.getFile(saveResult.hash);

      expect(result).toBeDefined();
      expect(result?.buffer.toString()).toBe('test content');
      expect(result?.mimeType).toBe('image/jpeg');
      expect(result?.size).toBe(buffer.length);
      expect(result?.metadata.hash).toBe(saveResult.hash);
    });

    it('should return null for non-existent file', () => {
      const result = api.getFile('nonexistent');
      expect(result).toBeNull();
    });

    it('should return null for deleted blob', () => {
      const buffer = Buffer.from('test');
      const saveResult = api.saveFile({
        buffer,
        mimeType: 'image/jpeg',
      });

      // Delete blob manually
      blobStorage.deleteBlob(saveResult.hash, 'jpg');

      const result = api.getFile(saveResult.hash);
      expect(result).toBeNull();
    });
  });

  describe('deleteFile API', () => {
    it('should soft delete file by default', () => {
      const buffer = Buffer.from('test');
      const saveResult = api.saveFile({
        buffer,
        mimeType: 'image/jpeg',
      });

      const result = api.deleteFile({ hash: saveResult.hash });

      expect(result.success).toBe(true);
      const metadata = db.getFile(saveResult.hash);
      expect(metadata?.is_deleted).toBe(1);
      expect(metadata?.deleted_at).toBeDefined();
      expect(blobStorage.blobExists(saveResult.hash, 'jpg')).toBe(true);
    });

    it('should hard delete file with hard=true', () => {
      const buffer = Buffer.from('test');
      const saveResult = api.saveFile({
        buffer,
        mimeType: 'image/jpeg',
      });

      const result = api.deleteFile({ hash: saveResult.hash, hard: true });

      expect(result.success).toBe(true);
      const metadata = db.getFile(saveResult.hash);
      expect(metadata).toBeNull();
      expect(blobStorage.blobExists(saveResult.hash, 'jpg')).toBe(false);
    });

    it('should hard delete file from queue too', () => {
      const buffer = Buffer.from('test');
      const saveResult = api.saveFile({
        buffer,
        mimeType: 'image/jpeg',
      });

      api.enqueueClassification({ hash: saveResult.hash });
      api.deleteFile({ hash: saveResult.hash, hard: true });

      const queueStatus = api.getQueueStatus();
      expect(queueStatus.total).toBe(0);
    });
  });

  describe('listFiles API', () => {
    beforeEach(() => {
      // Create multiple files
      for (let i = 1; i <= 5; i++) {
        api.saveFile({
          buffer: Buffer.from(`file${i}`),
          mimeType: i <= 2 ? 'image/jpeg' : 'video/mp4',
          capturedAt: new Date(2024, 0, i).toISOString(),
        });

        // Update category for first 2
        if (i <= 2) {
          const hash = calculateHash(Buffer.from(`file${i}`));
          api.updateMetadata({
            hash,
            updates: { category: 'cats' },
          });
        }
      }
    });

    it('should list files with pagination', () => {
      const result = api.listFiles({ limit: 3, offset: 0 });

      expect(result.items.length).toBe(3);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(true);
    });

    it('should filter by category', () => {
      const result = api.listFiles({ category: 'cats' });

      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.items.every(f => f.category === 'cats')).toBe(true);
    });

    it('should sort by captured_at descending', () => {
      const result = api.listFiles({
        orderBy: 'captured_at',
        order: 'desc',
        limit: 10,
      });

      expect(result.items[0].captured_at > result.items[1].captured_at).toBe(true);
    });

    it('should exclude deleted files by default', () => {
      const hashes = [
        calculateHash(Buffer.from('file1')),
        calculateHash(Buffer.from('file2')),
      ];

      api.deleteFile({ hash: hashes[0] });

      const result = api.listFiles({});
      // Total should be 4 (file2-5 are not deleted, file1 is deleted)
      expect(result.total).toBe(4);
      expect(result.items.every(f => f.is_deleted === 0)).toBe(true);
    });
  });

  describe('updateMetadata API', () => {
    it('should update metadata fields', () => {
      const buffer = Buffer.from('test');
      const saveResult = api.saveFile({
        buffer,
        mimeType: 'image/jpeg',
      });

      const result = api.updateMetadata({
        hash: saveResult.hash,
        updates: {
          category: 'dogs',
          ai_filename: 'cute_dog.jpg',
          confidence: 0.95,
          tags: ['cute', 'animal'],
        },
      });

      expect(result.success).toBe(true);
      expect(result.updatedMetadata?.category).toBe('dogs');
      expect(result.updatedMetadata?.ai_filename).toBe('cute_dog.jpg');
      expect(result.updatedMetadata?.confidence).toBe(0.95);
      expect(result.updatedMetadata?.tags).toBe(JSON.stringify(['cute', 'animal']));
    });

    it('should return success=false for non-existent file', () => {
      const result = api.updateMetadata({
        hash: 'nonexistent',
        updates: { category: 'test' },
      });

      expect(result.success).toBe(false);
      expect(result.updatedMetadata).toBeUndefined();
    });

    it('should update is_starred', () => {
      const buffer = Buffer.from('test');
      const saveResult = api.saveFile({
        buffer,
        mimeType: 'image/jpeg',
      });

      api.updateMetadata({
        hash: saveResult.hash,
        updates: { is_starred: true },
      });

      const metadata = api.getMetadata(saveResult.hash);
      expect(metadata?.is_starred).toBe(1);
    });
  });

  describe('getMetadata API', () => {
    it('should get file metadata', () => {
      const buffer = Buffer.from('test');
      const saveResult = api.saveFile({
        buffer,
        mimeType: 'image/jpeg',
        sourceUrl: 'https://example.com',
      });

      const metadata = api.getMetadata(saveResult.hash);

      expect(metadata).toBeDefined();
      expect(metadata?.hash).toBe(saveResult.hash);
      expect(metadata?.mime_type).toBe('image/jpeg');
      expect(metadata?.source_url).toBe('https://example.com');
    });

    it('should return null for non-existent file', () => {
      const metadata = api.getMetadata('nonexistent');
      expect(metadata).toBeNull();
    });
  });

  describe('getStats API', () => {
    beforeEach(() => {
      // Create mix of files
      api.saveFile({ buffer: Buffer.from('img1'), mimeType: 'image/jpeg' });
      api.saveFile({ buffer: Buffer.from('img2'), mimeType: 'image/png' });
      api.saveFile({ buffer: Buffer.from('vid1'), mimeType: 'video/mp4' });

      // Update categories
      const hash1 = calculateHash(Buffer.from('img1'));
      const hash2 = calculateHash(Buffer.from('img2'));
      api.updateMetadata({ hash: hash1, updates: { category: 'cats' } });
      api.updateMetadata({ hash: hash2, updates: { category: 'cats' } });
    });

    it('should return correct statistics', () => {
      const stats = api.getStats();

      expect(stats.totalFiles).toBe(3);
      expect(stats.images).toBe(2);
      expect(stats.videos).toBe(1);
      expect(stats.byCategory['cats']).toBe(2);
      expect(stats.byCategory['uncategorized']).toBe(1);
    });

    it('should calculate total size', () => {
      const stats = api.getStats();
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('getWorkspaceConfig API', () => {
    it('should return workspace path', () => {
      const config = api.getWorkspaceConfig();
      expect(config.path).toBe(testWorkspace);
    });
  });

  describe('setWorkspaceConfig API', () => {
    it('should fail to set workspace config', () => {
      const result = api.setWorkspaceConfig();
      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be changed');
    });
  });

  describe('enqueueClassification API', () => {
    it('should enqueue file for classification', () => {
      const buffer = Buffer.from('test');
      const saveResult = api.saveFile({
        buffer,
        mimeType: 'image/jpeg',
      });

      const result = api.enqueueClassification({
        hash: saveResult.hash,
        priority: 7,
      });

      expect(result.success).toBe(true);
      const queueStatus = api.getQueueStatus();
      expect(queueStatus.pending).toBe(1);
    });

    it('should fail for non-existent file', () => {
      const result = api.enqueueClassification({ hash: 'nonexistent' });
      expect(result.success).toBe(false);
    });

    it('should use default priority', () => {
      const buffer = Buffer.from('test');
      const saveResult = api.saveFile({
        buffer,
        mimeType: 'image/jpeg',
      });

      api.enqueueClassification({ hash: saveResult.hash });

      const tasks = api.getPendingTasks(1);
      expect(tasks[0].priority).toBe(5);
    });
  });

  describe('getQueueStatus API', () => {
    beforeEach(() => {
      // Create and enqueue files
      for (let i = 1; i <= 3; i++) {
        const buffer = Buffer.from(`task${i}`);
        const result = api.saveFile({ buffer, mimeType: 'image/jpeg' });
        api.enqueueClassification({ hash: result.hash });
      }

      // Update status for some
      const hash1 = calculateHash(Buffer.from('task1'));
      const hash2 = calculateHash(Buffer.from('task2'));
      api.updateTaskStatus({ hash: hash1, status: 'processing' });
      api.updateTaskStatus({ hash: hash2, status: 'completed' });
    });

    it('should return queue status summary', () => {
      const status = api.getQueueStatus();

      expect(status.pending).toBe(1);
      expect(status.processing).toBe(1);
      expect(status.completed).toBe(1);
      expect(status.failed).toBe(0);
      expect(status.total).toBe(3);
    });
  });

  describe('requeue classification API', () => {
    it('should requeue completed task as pending with new priority', () => {
      const buffer = Buffer.from('requeue-completed');
      const saveResult = api.saveFile({ buffer, mimeType: 'image/jpeg' });
      api.enqueueClassification({ hash: saveResult.hash, priority: 1 });
      api.updateTaskStatus({ hash: saveResult.hash, status: 'processing' });
      api.updateTaskStatus({ hash: saveResult.hash, status: 'completed' });

      const result = api.enqueueClassification({ hash: saveResult.hash, priority: 10 });
      const tasks = api.getPendingTasks(1);

      expect(result.success).toBe(true);
      expect(tasks[0].hash).toBe(saveResult.hash);
      expect(tasks[0].priority).toBe(10);
    });

    it('should requeue failed task as pending and clear error', () => {
      const buffer = Buffer.from('requeue-failed');
      const saveResult = api.saveFile({ buffer, mimeType: 'image/jpeg' });
      api.enqueueClassification({ hash: saveResult.hash });
      api.updateTaskStatus({ hash: saveResult.hash, status: 'failed', error: 'Error' });

      const result = api.enqueueClassification({ hash: saveResult.hash, priority: 9 });
      const tasks = api.getPendingTasks(1);

      expect(result.success).toBe(true);
      expect(tasks[0].hash).toBe(saveResult.hash);
      expect(tasks[0].priority).toBe(9);
    });

    it('should reject requeue for missing file', () => {
      const result = api.enqueueClassification({ hash: 'missing', priority: 10 });
      expect(result.success).toBe(false);
    });
  });

  describe('getPendingTasks API', () => {
    beforeEach(() => {
      // Create and enqueue files with different priorities
      for (let i = 1; i <= 5; i++) {
        const buffer = Buffer.from(`task${i}`);
        const result = api.saveFile({ buffer, mimeType: 'image/jpeg' });
        api.enqueueClassification({ hash: result.hash, priority: i });
      }
    });

    it('should get pending tasks sorted by priority', () => {
      const tasks = api.getPendingTasks(10);

      expect(tasks.length).toBe(5);
      // Highest priority first
      expect(tasks[0].priority).toBe(5);
      expect(tasks[4].priority).toBe(1);
    });

    it('should limit number of tasks', () => {
      const tasks = api.getPendingTasks(2);
      expect(tasks.length).toBe(2);
    });
  });

  describe('updateTaskStatus API', () => {
    it('should update task status to processing', () => {
      const buffer = Buffer.from('test');
      const saveResult = api.saveFile({ buffer, mimeType: 'image/jpeg' });
      api.enqueueClassification({ hash: saveResult.hash });

      const result = api.updateTaskStatus({
        hash: saveResult.hash,
        status: 'processing',
      });

      expect(result.success).toBe(true);
      const status = api.getQueueStatus();
      expect(status.processing).toBe(1);
    });

    it('should update task status to completed', () => {
      const buffer = Buffer.from('test');
      const saveResult = api.saveFile({ buffer, mimeType: 'image/jpeg' });
      api.enqueueClassification({ hash: saveResult.hash });

      api.updateTaskStatus({ hash: saveResult.hash, status: 'processing' });
      const result = api.updateTaskStatus({
        hash: saveResult.hash,
        status: 'completed',
      });

      expect(result.success).toBe(true);
      const status = api.getQueueStatus();
      expect(status.completed).toBe(1);
    });

    it('should update task status to failed with error', () => {
      const buffer = Buffer.from('test');
      const saveResult = api.saveFile({ buffer, mimeType: 'image/jpeg' });
      api.enqueueClassification({ hash: saveResult.hash });

      api.updateTaskStatus({ hash: saveResult.hash, status: 'processing' });
      const result = api.updateTaskStatus({
        hash: saveResult.hash,
        status: 'failed',
        error: 'Connection error',
      });

      expect(result.success).toBe(true);
      const status = api.getQueueStatus();
      expect(status.failed).toBe(1);
    });
  });

  describe('retryFailedTasks API', () => {
    it('should retry failed tasks', () => {
      const buffer = Buffer.from('test');
      const saveResult = api.saveFile({ buffer, mimeType: 'image/jpeg' });
      api.enqueueClassification({ hash: saveResult.hash });
      api.updateTaskStatus({ hash: saveResult.hash, status: 'failed', error: 'Error' });

      const result = api.retryFailedTasks();

      expect(result.count).toBe(1);
      const status = api.getQueueStatus();
      expect(status.pending).toBe(1);
      expect(status.failed).toBe(0);
    });

    it('should return 0 if no failed tasks', () => {
      const result = api.retryFailedTasks();
      expect(result.count).toBe(0);
    });
  });

  describe('clearQueue API', () => {
    it('should clear all tasks from queue', () => {
      const buffer = Buffer.from('test');
      const saveResult = api.saveFile({ buffer, mimeType: 'image/jpeg' });
      api.enqueueClassification({ hash: saveResult.hash });

      const result = api.clearQueue();

      expect(result.success).toBe(true);
      const status = api.getQueueStatus();
      expect(status.total).toBe(0);
    });
  });

  describe('getThumbnail API', () => {
    it('should return null for non-existent file', async () => {
      const result = await api.getThumbnail({ hash: 'nonexistent' });
      expect(result).toBeNull();
    });

    it('should return null for unsupported MIME type', async () => {
      const buffer = Buffer.from('test');
      const saveResult = api.saveFile({
        buffer,
        mimeType: 'application/octet-stream',
      });

      const result = await api.getThumbnail({ hash: saveResult.hash });
      expect(result).toBeNull();
    });

    // Note: Full thumbnail tests would require actual image/video files
    // and depend on sharp/ffmpeg being properly installed
    it.skip('should generate thumbnail for image', async () => {
      // This test requires a valid image file
      const buffer = Buffer.from('valid image data');
      const saveResult = api.saveFile({
        buffer,
        mimeType: 'image/jpeg',
      });

      const result = await api.getThumbnail({
        hash: saveResult.hash,
        size: 'small',
      });

      expect(result).toBeDefined();
      expect(result?.mimeType).toBe('image/jpeg');
    });
  });
});