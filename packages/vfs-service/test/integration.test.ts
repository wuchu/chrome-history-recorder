/**
 * VFS Service - Integration Tests
 *
 * Tests for complete workflows and system integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VFSAPI } from '../src/api.js';
import { SQLiteDatabase, ensureWorkspace } from '../src/sqlite.js';
import { BlobStorage, calculateHash } from '../src/blob.js';
import { ThumbnailStorage } from '../src/thumbnail.js';
import { createDispatcher, type VFSRequest } from '../src/dispatcher.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Integration Tests', () => {
  let api: VFSAPI;
  let db: SQLiteDatabase;
  let blobStorage: BlobStorage;
  let thumbnailStorage: ThumbnailStorage;
  let testWorkspace: string;
  let dispatcher: ReturnType<typeof createDispatcher>;

  beforeEach(() => {
    testWorkspace = path.join(os.tmpdir(), `vfs-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    ensureWorkspace(testWorkspace);
    db = new SQLiteDatabase(testWorkspace);
    blobStorage = new BlobStorage(testWorkspace);
    thumbnailStorage = new ThumbnailStorage(testWorkspace);
    api = new VFSAPI(db, blobStorage, thumbnailStorage, testWorkspace);
    dispatcher = createDispatcher(api);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // Ignore errors
    }
    if (fs.existsSync(testWorkspace)) {
      try {
        fs.rmSync(testWorkspace, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('20.1: Complete capture workflow (Network → Background → VFS)', () => {
    /**
     * Simulates the complete capture workflow:
     * 1. Network captures media data
     * 2. Background receives and saves to VFS
     * 3. VFS stores blob and metadata
     */

    it('should save captured image through dispatcher', async () => {
      // Simulate network capture
      const capturedMedia = {
        buffer: Buffer.from('simulated image data'),
        mimeType: 'image/jpeg',
        sourceUrl: 'https://example.com/photo.jpg',
        capturedAt: new Date().toISOString(),
      };

      // Simulate Background sending to VFS through the dispatcher
      const request: VFSRequest = {
        id: 1,
        method: 'saveFile',
        params: capturedMedia,
      };

      const response = await dispatcher(request);

      // Verify successful save
      expect(response.success).toBe(true);
      expect((response.data as any).hash).toBeDefined();
      expect((response.data as any).duplicate).toBe(false);

      // Verify blob is stored
      const hash = (response.data as any).hash;
      expect(blobStorage.blobExists(hash, 'jpg')).toBe(true);

      // Verify metadata is stored
      const metadata = api.getMetadata(hash);
      expect(metadata?.mime_type).toBe('image/jpeg');
      expect(metadata?.source_url).toBe('https://example.com/photo.jpg');
    });

    it('should handle multiple captures in sequence', async () => {
      const captures = [
        { buffer: Buffer.from('image1'), mimeType: 'image/jpeg' },
        { buffer: Buffer.from('image2'), mimeType: 'image/png' },
        { buffer: Buffer.from('video1'), mimeType: 'video/mp4' },
      ];

      const hashes: string[] = [];

      for (const capture of captures) {
        const request: VFSRequest = {
          method: 'saveFile',
          params: capture,
        };
        const response = await dispatcher(request);
        hashes.push((response.data as any).hash);
      }

      // Verify all files are saved
      const stats = api.getStats();
      expect(stats.totalFiles).toBe(3);
      expect(stats.images).toBe(2);
      expect(stats.videos).toBe(1);

      // Verify all blobs exist
      for (let i = 0; i < captures.length; i++) {
        const ext = captures[i].mimeType === 'image/jpeg' ? 'jpg' :
                    captures[i].mimeType === 'image/png' ? 'png' : 'mp4';
        expect(blobStorage.blobExists(hashes[i], ext)).toBe(true);
      }
    });

    it('should detect duplicate captures', async () => {
      // First capture
      const capture1 = {
        buffer: Buffer.from('unique content'),
        mimeType: 'image/jpeg',
      };

      const request1: VFSRequest = {
        method: 'saveFile',
        params: capture1,
      };
      const response1 = await dispatcher(request1);

      // Duplicate capture (same content)
      const capture2 = {
        buffer: Buffer.from('unique content'),
        mimeType: 'image/jpeg',
      };

      const request2: VFSRequest = {
        method: 'saveFile',
        params: capture2,
      };
      const response2 = await dispatcher(request2);

      // Verify duplicate detection
      expect((response1.data as any).hash).toBe((response2.data as any).hash);
      expect((response1.data as any).duplicate).toBe(false);
      expect((response2.data as any).duplicate).toBe(true);

      // Verify only one file in storage
      const stats = api.getStats();
      expect(stats.totalFiles).toBe(1);
    });

    it('should auto-enqueue for classification after capture', async () => {
      // Simulate capture with auto-enqueue
      const capture = {
        buffer: Buffer.from('test image'),
        mimeType: 'image/jpeg',
      };

      const saveRequest: VFSRequest = {
        method: 'saveFile',
        params: capture,
      };
      const saveResponse = await dispatcher(saveRequest);
      const hash = (saveResponse.data as any).hash;

      // Enqueue for classification
      const enqueueRequest: VFSRequest = {
        method: 'enqueueClassification',
        params: { hash },
      };
      const enqueueResponse = await dispatcher(enqueueRequest);

      expect(enqueueResponse.success).toBe(true);
      expect((enqueueResponse.data as any).success).toBe(true);

      // Verify task is in queue
      const queueStatus = api.getQueueStatus();
      expect(queueStatus.pending).toBe(1);
    });
  });

  describe('20.2: Classification workflow (VFS → Ollama → VFS metadata update)', () => {
    /**
     * Simulates the classification workflow:
     * 1. VFS retrieves file for classification
     * 2. Simulated Ollama classification
     * 3. VFS updates metadata with results
     */

    it('should process classification task end-to-end', async () => {
      // Setup: Save a file and enqueue
      const saveResult = api.saveFile({
        buffer: Buffer.from('image to classify'),
        mimeType: 'image/jpeg',
      });

      api.enqueueClassification({ hash: saveResult.hash });

      // Step 1: Get pending task
      const pendingRequest: VFSRequest = {
        method: 'getPendingTasks',
        params: { limit: 1 },
      };
      const pendingResponse = await dispatcher(pendingRequest);

      expect(pendingResponse.success).toBe(true);
      expect((pendingResponse.data as any).length).toBe(1);

      const task = (pendingResponse.data as any)[0];
      expect(task.hash).toBe(saveResult.hash);
      expect(task.status).toBe('pending');

      // Step 2: Mark as processing
      const processRequest: VFSRequest = {
        method: 'updateTaskStatus',
        params: { hash: saveResult.hash, status: 'processing' },
      };
      await dispatcher(processRequest);

      // Step 3: Get file for classification
      const fileRequest: VFSRequest = {
        method: 'getFile',
        params: { hash: saveResult.hash },
      };
      const fileResponse = await dispatcher(fileRequest);

      expect(fileResponse.success).toBe(true);
      expect((fileResponse.data as any).buffer).toBeDefined();

      // Step 4: Simulated classification result
      const classificationResult = {
        category: 'cats',
        ai_filename: 'cute_cat.jpg',
        confidence: 0.95,
        tags: ['cat', 'cute', 'animal'],
      };

      // Step 5: Update metadata
      const updateRequest: VFSRequest = {
        method: 'updateMetadata',
        params: {
          hash: saveResult.hash,
          updates: classificationResult,
        },
      };
      const updateResponse = await dispatcher(updateRequest);

      expect(updateResponse.success).toBe(true);
      expect((updateResponse.data as any).updatedMetadata?.category).toBe('cats');

      // Step 6: Mark task as completed
      const completeRequest: VFSRequest = {
        method: 'updateTaskStatus',
        params: { hash: saveResult.hash, status: 'completed' },
      };
      await dispatcher(completeRequest);

      // Verify final state
      const metadata = api.getMetadata(saveResult.hash);
      expect(metadata?.category).toBe('cats');
      expect(metadata?.ai_filename).toBe('cute_cat.jpg');
      expect(metadata?.confidence).toBe(0.95);

      const queueStatus = api.getQueueStatus();
      expect(queueStatus.completed).toBe(1);
    });

    it('should handle classification failure and retry', async () => {
      // Setup: Save and enqueue
      const saveResult = api.saveFile({
        buffer: Buffer.from('problematic image'),
        mimeType: 'image/jpeg',
      });
      api.enqueueClassification({ hash: saveResult.hash });

      // Simulate processing
      api.updateTaskStatus({ hash: saveResult.hash, status: 'processing' });

      // Simulate failure
      const failRequest: VFSRequest = {
        method: 'updateTaskStatus',
        params: {
          hash: saveResult.hash,
          status: 'failed',
          error: 'Ollama connection timeout',
        },
      };
      await dispatcher(failRequest);

      // Verify failure state
      const queueStatus = api.getQueueStatus();
      expect(queueStatus.failed).toBe(1);

      // Retry failed tasks
      const retryRequest: VFSRequest = {
        method: 'retryFailedTasks',
      };
      const retryResponse = await dispatcher(retryRequest);

      expect((retryResponse.data as any).count).toBe(1);

      // Verify tasks are back to pending
      const newQueueStatus = api.getQueueStatus();
      expect(newQueueStatus.pending).toBe(1);
      expect(newQueueStatus.failed).toBe(0);
    });

    it('should process multiple classification tasks', async () => {
      // Setup: Save multiple files
      const hashes: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const result = api.saveFile({
          buffer: Buffer.from(`image ${i}`),
          mimeType: 'image/jpeg',
        });
        hashes.push(result.hash);
        api.enqueueClassification({ hash: result.hash, priority: i });
      }

      // Process each task
      for (let i = 0; i < 3; i++) {
        api.updateTaskStatus({ hash: hashes[i], status: 'processing' });
        api.updateMetadata({
          hash: hashes[i],
          updates: { category: `category-${i + 1}` },
        });
        api.updateTaskStatus({ hash: hashes[i], status: 'completed' });
      }

      // Verify all completed
      const queueStatus = api.getQueueStatus();
      expect(queueStatus.completed).toBe(3);

      // Verify stats by category
      const stats = api.getStats();
      expect(stats.byCategory['category-1']).toBe(1);
      expect(stats.byCategory['category-2']).toBe(1);
      expect(stats.byCategory['category-3']).toBe(1);
    });
  });

  describe('20.3: DevTools Panel display workflow', () => {
    /**
     * Simulates DevTools Panel operations:
     * 1. Load file list
     * 2. View thumbnails
     * 3. Check classification status
     */

    it('should list files for DevTools Panel', async () => {
      // Setup: Create multiple files
      for (let i = 1; i <= 10; i++) {
        api.saveFile({
          buffer: Buffer.from(`file ${i}`),
          mimeType: i <= 5 ? 'image/jpeg' : 'video/mp4',
          capturedAt: new Date(2024, 0, i).toISOString(),
        });
      }

      // Panel requests file list
      const listRequest: VFSRequest = {
        method: 'listFiles',
        params: {
          limit: 5,
          offset: 0,
          orderBy: 'captured_at',
          order: 'desc',
        },
      };
      const listResponse = await dispatcher(listRequest);

      expect(listResponse.success).toBe(true);
      expect((listResponse.data as any).items.length).toBe(5);
      expect((listResponse.data as any).total).toBe(10);
      expect((listResponse.data as any).hasMore).toBe(true);

      // Verify ordering (newest first)
      const items = (listResponse.data as any).items;
      expect(new Date(items[0].captured_at) > new Date(items[1].captured_at)).toBe(true);
    });

    it('should filter files by category', async () => {
      // Setup: Create files with different categories
      const cat1 = api.saveFile({ buffer: Buffer.from('cat1'), mimeType: 'image/jpeg' });
      const cat2 = api.saveFile({ buffer: Buffer.from('cat2'), mimeType: 'image/jpeg' });
      const dog1 = api.saveFile({ buffer: Buffer.from('dog1'), mimeType: 'image/jpeg' });

      api.updateMetadata({ hash: cat1.hash, updates: { category: 'cats' } });
      api.updateMetadata({ hash: cat2.hash, updates: { category: 'cats' } });
      api.updateMetadata({ hash: dog1.hash, updates: { category: 'dogs' } });

      // Panel requests cats category
      const catsRequest: VFSRequest = {
        method: 'listFiles',
        params: { category: 'cats' },
      };
      const catsResponse = await dispatcher(catsRequest);

      expect((catsResponse.data as any).total).toBe(2);
      expect((catsResponse.data as any).items.every(f => f.category === 'cats')).toBe(true);
    });

    it('should show classification status for each file', async () => {
      // Setup: Create files with different classification states
      const pendingFile = api.saveFile({ buffer: Buffer.from('pending'), mimeType: 'image/jpeg' });
      const completedFile = api.saveFile({ buffer: Buffer.from('completed'), mimeType: 'image/jpeg' });

      api.enqueueClassification({ hash: pendingFile.hash });
      api.enqueueClassification({ hash: completedFile.hash });
      api.updateTaskStatus({ hash: completedFile.hash, status: 'processing' });
      api.updateTaskStatus({ hash: completedFile.hash, status: 'completed' });

      // Get queue status
      const statusRequest: VFSRequest = {
        method: 'getQueueStatus',
      };
      const statusResponse = await dispatcher(statusRequest);

      expect((statusResponse.data as any).pending).toBe(1);
      expect((statusResponse.data as any).completed).toBe(1);
    });

    it('should get file metadata for display', async () => {
      // Setup: Create classified file
      const saveResult = api.saveFile({
        buffer: Buffer.from('classified image'),
        mimeType: 'image/jpeg',
        sourceUrl: 'https://example.com/classified.jpg',
      });

      api.updateMetadata({
        hash: saveResult.hash,
        updates: {
          category: 'landscapes',
          ai_filename: 'mountain_view.jpg',
          confidence: 0.88,
          is_starred: true,
        },
      });

      // Panel requests metadata
      const metadataRequest: VFSRequest = {
        method: 'getMetadata',
        params: { hash: saveResult.hash },
      };
      const metadataResponse = await dispatcher(metadataRequest);

      expect(metadataResponse.success).toBe(true);
      const metadata = metadataResponse.data as any;
      expect(metadata.category).toBe('landscapes');
      expect(metadata.ai_filename).toBe('mountain_view.jpg');
      expect(metadata.confidence).toBe(0.88);
      expect(metadata.is_starred).toBe(1);
    });

    it('should handle thumbnail request (simulated)', async () => {
      // Setup: Create image file
      const saveResult = api.saveFile({
        buffer: Buffer.from('image for thumbnail'),
        mimeType: 'image/jpeg',
      });

      // Note: Full thumbnail test requires actual image processing
      // This test verifies the request/response flow
      const thumbnailRequest: VFSRequest = {
        method: 'getThumbnail',
        params: { hash: saveResult.hash, size: 'small' },
      };

      // Thumbnail generation may fail with non-image data
      const thumbnailResponse = await dispatcher(thumbnailRequest);
      // Current implementation returns null for non-image buffers
      // In production, this would return actual thumbnail data
      expect(thumbnailResponse.success).toBe(true);
    });
  });

  describe('20.4: Dispatcher request workflow', () => {
    /**
     * Tests dispatcher request handling:
     * - Request/response format
     * - Request lifecycle
     * - Error handling
     */

    it('should handle request with id', async () => {
      const request: VFSRequest = {
        id: 12345,
        method: 'getStats',
      };

      const response = await dispatcher(request);

      expect(response.id).toBe(12345);
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    it('should handle request without id', async () => {
      const request: VFSRequest = {
        method: 'getWorkspaceConfig',
      };

      const response = await dispatcher(request);

      expect(response.id).toBeUndefined();
      expect(response.success).toBe(true);
      expect((response.data as any).path).toBe(testWorkspace);
    });

    it('should handle multiple sequential requests', async () => {
      const requests = [
        { id: 1, method: 'saveFile', params: { buffer: Buffer.from('test1'), mimeType: 'image/jpeg' } },
        { id: 2, method: 'getStats' },
        { id: 3, method: 'listFiles', params: { limit: 10 } },
        { id: 4, method: 'getWorkspaceConfig' },
      ];

      for (const req of requests) {
        const response = await dispatcher(req as VFSRequest);
        expect(response.id).toBe(req.id);
        expect(response.success).toBe(true);
      }
    });

    it('should return error for unknown method', async () => {
      const request: VFSRequest = {
        id: 999,
        method: 'invalidMethod',
      };

      const response = await dispatcher(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Unknown method');
    });

    it('should handle workspace config request', async () => {
      const request: VFSRequest = {
        method: 'getWorkspaceConfig',
      };

      const response = await dispatcher(request);

      expect(response.success).toBe(true);
      expect((response.data as any).path).toBe(testWorkspace);
    });
  });

  describe('20.5: Configuration save and load workflow', () => {
    /**
     * Tests configuration management:
     * - Get/set workspace config
     * - Config persistence (simulated)
     */

    it('should get workspace configuration', async () => {
      const request: VFSRequest = {
        method: 'getWorkspaceConfig',
      };

      const response = await dispatcher(request);

      expect(response.success).toBe(true);
      expect((response.data as any).path).toBe(testWorkspace);
    });

    it('should not allow changing workspace config', async () => {
      const request: VFSRequest = {
        method: 'setWorkspaceConfig',
        params: { path: '/new/path' },
      };

      const response = await dispatcher(request);

      // setWorkspaceConfig returns { success: false, error: ... } as data
      // The dispatcher wraps this in success: true
      expect(response.success).toBe(true);
      expect((response.data as any).success).toBe(false);
      expect((response.data as any).error).toContain('cannot be changed');
    });

    it('should provide stats for monitoring', async () => {
      // Setup: Create some files with unique content
      api.saveFile({ buffer: Buffer.from('test-image'), mimeType: 'image/jpeg' });
      api.saveFile({ buffer: Buffer.from('test-video'), mimeType: 'video/mp4' });

      const request: VFSRequest = {
        method: 'getStats',
      };

      const response = await dispatcher(request);

      expect(response.success).toBe(true);
      const stats = response.data as any;
      expect(stats.totalFiles).toBe(2);
      expect(stats.images).toBe(1);
      expect(stats.videos).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.byCategory).toBeDefined();
    });
  });

  describe('End-to-end scenario tests', () => {
    it('should complete full capture-classify-display cycle', async () => {
      // 1. Capture
      const captureRequest: VFSRequest = {
        id: 1,
        method: 'saveFile',
        params: {
          buffer: Buffer.from('full workflow test'),
          mimeType: 'image/jpeg',
          sourceUrl: 'https://example.com/test.jpg',
        },
      };
      const captureResponse = await dispatcher(captureRequest);
      expect(captureResponse.success).toBe(true);
      const hash = (captureResponse.data as any).hash;

      // 2. Enqueue for classification
      const enqueueRequest: VFSRequest = {
        id: 2,
        method: 'enqueueClassification',
        params: { hash },
      };
      await dispatcher(enqueueRequest);

      // 3. Process classification
      api.updateTaskStatus({ hash, status: 'processing' });
      api.updateMetadata({
        hash,
        updates: { category: 'test-category', confidence: 0.9 },
      });
      api.updateTaskStatus({ hash, status: 'completed' });

      // 4. Display in panel
      const listRequest: VFSRequest = {
        id: 3,
        method: 'listFiles',
        params: { limit: 10 },
      };
      const listResponse = await dispatcher(listRequest);
      expect((listResponse.data as any).total).toBe(1);

      // 5. View details
      const metadataRequest: VFSRequest = {
        id: 4,
        method: 'getMetadata',
        params: { hash },
      };
      const metadataResponse = await dispatcher(metadataRequest);
      expect((metadataResponse.data as any).category).toBe('test-category');

      // 6. Verify final state
      const statsRequest: VFSRequest = {
        id: 5,
        method: 'getStats',
      };
      const statsResponse = await dispatcher(statsRequest);
      expect((statsResponse.data as any).totalFiles).toBe(1);
      expect((statsResponse.data as any).byCategory['test-category']).toBe(1);
    });

    it('should handle delete workflow', async () => {
      // Setup: Create file
      const saveResult = api.saveFile({
        buffer: Buffer.from('to be deleted'),
        mimeType: 'image/jpeg',
      });

      // Soft delete
      const softDeleteRequest: VFSRequest = {
        method: 'deleteFile',
        params: { hash: saveResult.hash },
      };
      const softDeleteResponse = await dispatcher(softDeleteRequest);
      expect(softDeleteResponse.success).toBe(true);

      // Verify soft deleted (not in default list)
      const listRequest: VFSRequest = {
        method: 'listFiles',
        params: {},
      };
      const listResponse = await dispatcher(listRequest);
      expect((listResponse.data as any).total).toBe(0);

      // Hard delete
      const hardDeleteRequest: VFSRequest = {
        method: 'deleteFile',
        params: { hash: saveResult.hash, hard: true },
      };
      const hardDeleteResponse = await dispatcher(hardDeleteRequest);
      expect(hardDeleteResponse.success).toBe(true);

      // Verify completely removed
      const metadataRequest: VFSRequest = {
        method: 'getMetadata',
        params: { hash: saveResult.hash },
      };
      const metadataResponse = await dispatcher(metadataRequest);
      expect(metadataResponse.data).toBeNull();
    });
  });
});