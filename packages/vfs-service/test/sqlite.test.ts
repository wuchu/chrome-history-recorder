/**
 * VFS Service - SQLite Module Tests
 *
 * Tests for SQLite database operations including CRUD, queries, and queue management.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteDatabase, ensureWorkspace } from '../src/sqlite.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('SQLiteDatabase', () => {
  let db: SQLiteDatabase;
  let testWorkspace: string;

  beforeEach(() => {
    // Create unique test workspace for each test
    testWorkspace = path.join(os.tmpdir(), `vfs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    ensureWorkspace(testWorkspace);
    // Add small delay to ensure workspace is fully created
    db = new SQLiteDatabase(testWorkspace);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // Database may not be initialized if test failed early
    }
    // Clean up test workspace
    if (fs.existsSync(testWorkspace)) {
      try {
        fs.rmSync(testWorkspace, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('Database initialization', () => {
    it('should create database file in workspace', () => {
      // Ensure blobs directory exists before creating database
      const blobsDir = path.join(testWorkspace, 'blobs');
      if (!fs.existsSync(blobsDir)) {
        fs.mkdirSync(blobsDir, { recursive: true });
      }
      expect(db.getDbPath()).toBe(path.join(testWorkspace, 'vfs.db'));
      expect(fs.existsSync(db.getDbPath())).toBe(true);
    });

    it('should initialize files table with correct schema', () => {
      const metadata = {
        hash: 'test123',
        blob_ext: 'jpg',
        mime_type: 'image/jpeg',
        size: 1024,
        source_url: 'https://example.com',
        captured_at: new Date().toISOString(),
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
      };

      db.insertFile(metadata);
      const file = db.getFile('test123');
      expect(file).toBeDefined();
      expect(file?.hash).toBe('test123');
    });

    it('should initialize classify_queue table', () => {
      db.insertFile({
        hash: 'queue123',
        blob_ext: 'png',
        mime_type: 'image/png',
        size: 2048,
        source_url: null,
        captured_at: new Date().toISOString(),
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

      const success = db.enqueueClassification('queue123');
      expect(success).toBe(true);

      const task = db.getNextPendingTask();
      expect(task).toBeDefined();
      expect(task?.hash).toBe('queue123');
    });
  });

  describe('File CRUD operations', () => {
    beforeEach(() => {
      // Insert test file
      db.insertFile({
        hash: 'abc123',
        blob_ext: 'jpg',
        mime_type: 'image/jpeg',
        size: 1024,
        source_url: 'https://example.com/image.jpg',
        captured_at: '2024-01-01T00:00:00.000Z',
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
    });

    it('should insert file with all metadata fields', () => {
      const file = db.getFile('abc123');
      expect(file).toBeDefined();
      expect(file?.hash).toBe('abc123');
      expect(file?.blob_ext).toBe('jpg');
      expect(file?.mime_type).toBe('image/jpeg');
      expect(file?.size).toBe(1024);
      expect(file?.source_url).toBe('https://example.com/image.jpg');
      expect(file?.captured_at).toBe('2024-01-01T00:00:00.000Z');
      expect(file?.category).toBe('uncategorized');
      expect(file?.created_at).toBeDefined();
      expect(file?.updated_at).toBeDefined();
    });

    it('should check if file exists', () => {
      expect(db.fileExists('abc123')).toBe(true);
      expect(db.fileExists('nonexistent')).toBe(false);
    });

    it('should get file by hash', () => {
      const file = db.getFile('abc123');
      expect(file?.hash).toBe('abc123');
    });

    it('should return null for non-existent file', () => {
      const file = db.getFile('nonexistent');
      expect(file).toBeNull();
    });

    it('should update file metadata', async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      db.updateMetadata('abc123', {
        category: 'cats',
        ai_filename: 'cute_cat.jpg',
        confidence: 0.95,
        is_starred: true,
      });

      const file = db.getFile('abc123');
      expect(file?.category).toBe('cats');
      expect(file?.ai_filename).toBe('cute_cat.jpg');
      expect(file?.confidence).toBe(0.95);
      expect(file?.is_starred).toBe(1);
      // updated_at should be different or equal (due to same timestamp resolution)
      expect(file?.updated_at).toBeDefined();
    });

    it('should update tags as JSON array', () => {
      db.updateMetadata('abc123', {
        tags: ['cat', 'cute', 'animal'],
      });

      const file = db.getFile('abc123');
      expect(file?.tags).toBe(JSON.stringify(['cat', 'cute', 'animal']));
    });

    it('should soft delete file', () => {
      const success = db.softDeleteFile('abc123');
      expect(success).toBe(true);

      const file = db.getFile('abc123');
      expect(file?.is_deleted).toBe(1);
      expect(file?.deleted_at).toBeDefined();
    });

    it('should restore soft-deleted file', () => {
      db.softDeleteFile('abc123');
      const success = db.restoreFile('abc123');
      expect(success).toBe(true);

      const file = db.getFile('abc123');
      expect(file?.is_deleted).toBe(0);
      expect(file?.deleted_at).toBeNull();
    });

    it('should hard delete file', () => {
      // Enqueue to queue first
      db.enqueueClassification('abc123');

      const success = db.hardDeleteFile('abc123');
      expect(success).toBe(true);

      const file = db.getFile('abc123');
      expect(file).toBeNull();

      // Should also be removed from queue
      const task = db.getNextPendingTask();
      expect(task?.hash).not.toBe('abc123');
    });
  });

  describe('List files queries', () => {
    beforeEach(() => {
      // Insert multiple test files
      for (let i = 1; i <= 10; i++) {
        db.insertFile({
          hash: `file${i.toString().padStart(3, '0')}`,
          blob_ext: 'jpg',
          mime_type: 'image/jpeg',
          size: 1024 * i,
          source_url: `https://example.com/${i}.jpg`,
          captured_at: new Date(2024, 0, i).toISOString(),
          category: i <= 3 ? 'cats' : i <= 6 ? 'dogs' : 'uncategorized',
          ai_filename: null,
          tags: null,
          confidence: 0,
          classified_at: null,
          model_used: null,
          is_starred: i === 1 ? 1 : 0,
          user_notes: null,
          is_deleted: 0,
          deleted_at: null,
        });
      }

      // Insert a soft-deleted file
      db.insertFile({
        hash: 'deleted001',
        blob_ext: 'jpg',
        mime_type: 'image/jpeg',
        size: 512,
        source_url: null,
        captured_at: new Date().toISOString(),
        category: 'uncategorized',
        ai_filename: null,
        tags: null,
        confidence: 0,
        classified_at: null,
        model_used: null,
        is_starred: 0,
        user_notes: null,
        is_deleted: 1,
        deleted_at: new Date().toISOString(),
      });
    });

    it('should list files with pagination', () => {
      const result = db.listFiles({ limit: 5, offset: 0 });
      expect(result.items.length).toBe(5);
      expect(result.total).toBe(10);
      expect(result.hasMore).toBe(true);
    });

    it('should list files with offset', () => {
      const page1 = db.listFiles({ limit: 5, offset: 0 });
      const page2 = db.listFiles({ limit: 5, offset: 5 });
      expect(page1.items[0].hash).not.toBe(page2.items[0].hash);
      expect(page2.hasMore).toBe(false);
    });

    it('should filter by category', () => {
      const result = db.listFiles({ category: 'cats' });
      expect(result.items.length).toBe(3);
      expect(result.total).toBe(3);
      expect(result.items.every(f => f.category === 'cats')).toBe(true);
    });

    it('should sort by captured_at descending', () => {
      const result = db.listFiles({ orderBy: 'captured_at', order: 'desc', limit: 3 });
      expect(result.items[0].captured_at > result.items[1].captured_at).toBe(true);
    });

    it('should sort by captured_at ascending', () => {
      const result = db.listFiles({ orderBy: 'captured_at', order: 'asc', limit: 3 });
      expect(result.items[0].captured_at < result.items[1].captured_at).toBe(true);
    });

    it('should exclude deleted files by default', () => {
      const result = db.listFiles({});
      expect(result.items.every(f => f.is_deleted === 0)).toBe(true);
      expect(result.total).toBe(10);
    });

    it('should include deleted files when requested', () => {
      const result = db.listFiles({ includeDeleted: true });
      expect(result.total).toBe(11);
      expect(result.items.some(f => f.is_deleted === 1)).toBe(true);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      // Insert mixed content files
      db.insertFile({
        hash: 'img001',
        blob_ext: 'jpg',
        mime_type: 'image/jpeg',
        size: 1024,
        source_url: null,
        captured_at: new Date().toISOString(),
        category: 'cats',
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

      db.insertFile({
        hash: 'img002',
        blob_ext: 'png',
        mime_type: 'image/png',
        size: 2048,
        source_url: null,
        captured_at: new Date().toISOString(),
        category: 'cats',
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

      db.insertFile({
        hash: 'vid001',
        blob_ext: 'mp4',
        mime_type: 'video/mp4',
        size: 10240,
        source_url: null,
        captured_at: new Date().toISOString(),
        category: 'dogs',
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

      db.insertFile({
        hash: 'deleted002',
        blob_ext: 'jpg',
        mime_type: 'image/jpeg',
        size: 512,
        source_url: null,
        captured_at: new Date().toISOString(),
        category: 'uncategorized',
        ai_filename: null,
        tags: null,
        confidence: 0,
        classified_at: null,
        model_used: null,
        is_starred: 0,
        user_notes: null,
        is_deleted: 1,
        deleted_at: new Date().toISOString(),
      });
    });

    it('should return correct statistics', () => {
      const stats = db.getStats();
      expect(stats.totalFiles).toBe(3);
      expect(stats.totalSize).toBe(1024 + 2048 + 10240);
      expect(stats.images).toBe(2);
      expect(stats.videos).toBe(1);
      expect(stats.byCategory['cats']).toBe(2);
      expect(stats.byCategory['dogs']).toBe(1);
    });
  });

  describe('Classification queue operations', () => {
    beforeEach(() => {
      // Insert test files
      for (let i = 1; i <= 5; i++) {
        db.insertFile({
          hash: `task${i}`,
          blob_ext: 'jpg',
          mime_type: 'image/jpeg',
          size: 1024,
          source_url: null,
          captured_at: new Date().toISOString(),
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
      }
    });

    it('should enqueue classification task', () => {
      const success = db.enqueueClassification('task1', 5);
      expect(success).toBe(true);

      const task = db.getNextPendingTask();
      expect(task?.hash).toBe('task1');
      expect(task?.status).toBe('pending');
      expect(task?.priority).toBe(5);
    });

    it('should fail enqueue for non-existent file', () => {
      const success = db.enqueueClassification('nonexistent');
      expect(success).toBe(false);
    });

    it('should requeue completed task as pending and clear terminal fields', () => {
      db.enqueueClassification('task1');
      db.updateTaskStatus('task1', 'processing');
      db.updateTaskStatus('task1', 'completed');

      const success = db.enqueueClassification('task1', 9);
      expect(success).toBe(true);

      const tasks = db.getPendingTasks(1);
      expect(tasks[0].hash).toBe('task1');
      expect(tasks[0].priority).toBe(9);
      expect(tasks[0].completed_at).toBeNull();
      expect(tasks[0].started_at).toBeNull();
      expect(tasks[0].retries).toBe(0);
    });

    it('should requeue failed task as pending and clear error', () => {
      db.enqueueClassification('task1');
      db.updateTaskStatus('task1', 'failed', 'Error');

      const success = db.enqueueClassification('task1', 8);
      expect(success).toBe(true);

      const tasks = db.getPendingTasks(1);
      expect(tasks[0].hash).toBe('task1');
      expect(tasks[0].priority).toBe(8);
      expect(tasks[0].error).toBeNull();
      expect(tasks[0].retries).toBe(0);
    });

    it('should get next pending task by priority', () => {
      db.enqueueClassification('task1', 3);
      db.enqueueClassification('task2', 7);
      db.enqueueClassification('task3', 5);

      const task = db.getNextPendingTask();
      expect(task?.hash).toBe('task2'); // Highest priority
    });

    it('should update task status to processing', () => {
      db.enqueueClassification('task1');
      db.updateTaskStatus('task1', 'processing');

      const task = db.getNextPendingTask();
      expect(task?.hash).not.toBe('task1'); // Not pending anymore

      const status = db.getQueueStatus();
      expect(status.processing).toBe(1);
    });

    it('should update task status to completed', () => {
      db.enqueueClassification('task1');
      db.updateTaskStatus('task1', 'processing');
      db.updateTaskStatus('task1', 'completed');

      const status = db.getQueueStatus();
      expect(status.completed).toBe(1);
    });

    it('should update task status to failed with error', () => {
      db.enqueueClassification('task1');
      db.updateTaskStatus('task1', 'processing');
      db.updateTaskStatus('task1', 'failed', 'Ollama connection error');

      const failedTasks = db.getFailedTasks();
      expect(failedTasks.length).toBe(1);
      expect(failedTasks[0].error).toBe('Ollama connection error');
      expect(failedTasks[0].retries).toBe(1);
    });

    it('should get queue status summary', () => {
      db.enqueueClassification('task1');
      db.enqueueClassification('task2');
      db.enqueueClassification('task3');
      db.updateTaskStatus('task1', 'processing');
      db.updateTaskStatus('task2', 'completed');
      db.updateTaskStatus('task3', 'failed', 'Error');

      const status = db.getQueueStatus();
      expect(status.pending).toBe(0);
      expect(status.processing).toBe(1);
      expect(status.completed).toBe(1);
      expect(status.failed).toBe(1);
      expect(status.total).toBe(3);
    });

    it('should get pending tasks list', () => {
      db.enqueueClassification('task1');
      db.enqueueClassification('task2');
      db.enqueueClassification('task3');

      const tasks = db.getPendingTasks(2);
      expect(tasks.length).toBe(2);
    });

    it('should retry failed tasks', () => {
      db.enqueueClassification('task1');
      db.updateTaskStatus('task1', 'failed', 'Error');

      const count = db.retryFailedTasks();
      expect(count).toBe(1);

      const status = db.getQueueStatus();
      expect(status.pending).toBe(1);
      expect(status.failed).toBe(0);
    });

    it('should clear queue', () => {
      db.enqueueClassification('task1');
      db.enqueueClassification('task2');

      db.clearQueue();
      const status = db.getQueueStatus();
      expect(status.total).toBe(0);
    });
  });
});