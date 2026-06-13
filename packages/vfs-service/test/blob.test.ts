/**
 * VFS Service - Blob Storage Module Tests
 *
 * Tests for blob storage operations including save, read, delete, and hash calculation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BlobStorage, calculateHash, getExtensionFromMimeType, getMimeTypeFromExtension } from '../src/blob.js';
import { ensureWorkspace } from '../src/sqlite.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

describe('BlobStorage', () => {
  let blobStorage: BlobStorage;
  let testWorkspace: string;

  beforeEach(() => {
    // Create unique test workspace for each test
    testWorkspace = path.join(os.tmpdir(), `vfs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    ensureWorkspace(testWorkspace);
    blobStorage = new BlobStorage(testWorkspace);
  });

  afterEach(() => {
    // Clean up test workspace
    if (fs.existsSync(testWorkspace)) {
      try {
        fs.rmSync(testWorkspace, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('Hash calculation', () => {
    it('should calculate SHA-256 hash truncated to 16 characters', () => {
      const buffer = Buffer.from('test content');
      const hash = calculateHash(buffer);

      // Verify it's 16 characters
      expect(hash.length).toBe(16);

      // Verify it matches expected hash
      const fullHash = crypto.createHash('sha256').update(buffer).digest('hex');
      expect(hash).toBe(fullHash.substring(0, 16));
    });

    it('should return same hash for same content', () => {
      const buffer1 = Buffer.from('same content');
      const buffer2 = Buffer.from('same content');
      expect(calculateHash(buffer1)).toBe(calculateHash(buffer2));
    });

    it('should return different hash for different content', () => {
      const buffer1 = Buffer.from('content 1');
      const buffer2 = Buffer.from('content 2');
      expect(calculateHash(buffer1)).not.toBe(calculateHash(buffer2));
    });

    it('should handle binary content', () => {
      const buffer = Buffer.from([0x00, 0xFF, 0xAB, 0xCD]);
      const hash = calculateHash(buffer);
      expect(hash.length).toBe(16);
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should handle empty buffer', () => {
      const buffer = Buffer.from('');
      const hash = calculateHash(buffer);
      expect(hash.length).toBe(16);
      // Empty string SHA-256 starts with e3b0c442...
      expect(hash).toBe('e3b0c44298fc1c14');
    });
  });

  describe('MIME type conversion', () => {
    it('should convert common MIME types to extensions', () => {
      expect(getExtensionFromMimeType('image/jpeg')).toBe('jpg');
      expect(getExtensionFromMimeType('image/png')).toBe('png');
      expect(getExtensionFromMimeType('image/gif')).toBe('gif');
      expect(getExtensionFromMimeType('image/webp')).toBe('webp');
      expect(getExtensionFromMimeType('video/mp4')).toBe('mp4');
      expect(getExtensionFromMimeType('video/webm')).toBe('webm');
      expect(getExtensionFromMimeType('video/quicktime')).toBe('mov');
    });

    it('should return bin for unknown MIME types', () => {
      expect(getExtensionFromMimeType('application/unknown')).toBe('bin');
      expect(getExtensionFromMimeType('text/plain')).toBe('bin');
    });

    it('should convert extensions to MIME types', () => {
      expect(getMimeTypeFromExtension('jpg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('jpeg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('png')).toBe('image/png');
      expect(getMimeTypeFromExtension('mp4')).toBe('video/mp4');
    });

    it('should return octet-stream for unknown extensions', () => {
      expect(getMimeTypeFromExtension('xyz')).toBe('application/octet-stream');
      expect(getMimeTypeFromExtension('')).toBe('application/octet-stream');
    });

    it('should handle uppercase extensions', () => {
      expect(getMimeTypeFromExtension('JPG')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('PNG')).toBe('image/png');
    });
  });

  describe('Blob save operations', () => {
    it('should save blob to correct path', () => {
      const buffer = Buffer.from('test image data');
      const hash = calculateHash(buffer);
      const result = blobStorage.saveBlob(buffer, hash, 'image/jpeg');

      expect(result.saved).toBe(true);
      expect(result.ext).toBe('jpg');
      expect(result.size).toBe(buffer.length);

      const expectedPath = path.join(testWorkspace, 'blobs', `${hash}.jpg`);
      expect(fs.existsSync(expectedPath)).toBe(true);
    });

    it('should detect duplicate blob', () => {
      const buffer = Buffer.from('duplicate content');
      const hash = calculateHash(buffer);

      // First save
      const result1 = blobStorage.saveBlob(buffer, hash, 'image/png');
      expect(result1.saved).toBe(true);

      // Second save (duplicate)
      const result2 = blobStorage.saveBlob(buffer, hash, 'image/png');
      expect(result2.saved).toBe(false);
      expect(result2.duplicate).toBeUndefined(); // Not in return type
    });

    it('should handle different MIME types', () => {
      const buffer = Buffer.from('test');
      const hash = calculateHash(buffer);

      const jpgResult = blobStorage.saveBlob(buffer, hash, 'image/jpeg');
      expect(jpgResult.ext).toBe('jpg');

      // Clean up for next test
      blobStorage.deleteBlob(hash, 'jpg');

      const pngResult = blobStorage.saveBlob(buffer, hash, 'image/png');
      expect(pngResult.ext).toBe('png');
    });

    it('should save with correct file permissions', () => {
      const buffer = Buffer.from('test');
      const hash = calculateHash(buffer);
      blobStorage.saveBlob(buffer, hash, 'image/jpeg');

      const filePath = blobStorage.getBlobPath(hash, 'jpg');
      const stats = fs.statSync(filePath);
      // Mode 0o644 means read/write for owner, read for group/others
      expect(stats.mode & 0o777).toBe(0o644);
    });
  });

  describe('Blob read operations', () => {
    it('should read saved blob', () => {
      const buffer = Buffer.from('test image data');
      const hash = calculateHash(buffer);
      blobStorage.saveBlob(buffer, hash, 'image/jpeg');

      const readBuffer = blobStorage.readBlob(hash, 'jpg');
      expect(readBuffer).toBeDefined();
      expect(readBuffer?.toString()).toBe('test image data');
    });

    it('should return null for non-existent blob', () => {
      const readBuffer = blobStorage.readBlob('nonexistent', 'jpg');
      expect(readBuffer).toBeNull();
    });

    it('should read binary content correctly', () => {
      const buffer = Buffer.from([0x00, 0xFF, 0xAB, 0xCD, 0xEF]);
      const hash = calculateHash(buffer);
      blobStorage.saveBlob(buffer, hash, 'image/png');

      const readBuffer = blobStorage.readBlob(hash, 'png');
      expect(readBuffer).toBeDefined();
      expect(readBuffer?.equals(buffer)).toBe(true);
    });

    it('should read large files', () => {
      // Create a 1MB buffer
      const buffer = Buffer.alloc(1024 * 1024, 0xAB);
      const hash = calculateHash(buffer);
      blobStorage.saveBlob(buffer, hash, 'video/mp4');

      const readBuffer = blobStorage.readBlob(hash, 'mp4');
      expect(readBuffer?.length).toBe(1024 * 1024);
    });
  });

  describe('Blob existence check', () => {
    it('should return true for existing blob', () => {
      const buffer = Buffer.from('test');
      const hash = calculateHash(buffer);
      blobStorage.saveBlob(buffer, hash, 'image/jpeg');

      expect(blobStorage.blobExists(hash, 'jpg')).toBe(true);
    });

    it('should return false for non-existent blob', () => {
      expect(blobStorage.blobExists('nonexistent', 'jpg')).toBe(false);
    });

    it('should return false for wrong extension', () => {
      const buffer = Buffer.from('test');
      const hash = calculateHash(buffer);
      blobStorage.saveBlob(buffer, hash, 'image/jpeg');

      expect(blobStorage.blobExists(hash, 'png')).toBe(false);
    });
  });

  describe('Blob delete operations', () => {
    it('should delete existing blob', () => {
      const buffer = Buffer.from('test');
      const hash = calculateHash(buffer);
      blobStorage.saveBlob(buffer, hash, 'image/jpeg');

      const success = blobStorage.deleteBlob(hash, 'jpg');
      expect(success).toBe(true);
      expect(fs.existsSync(blobStorage.getBlobPath(hash, 'jpg'))).toBe(false);
    });

    it('should return false for non-existent blob', () => {
      const success = blobStorage.deleteBlob('nonexistent', 'jpg');
      expect(success).toBe(false);
    });

    it('should not affect other blobs', () => {
      const buffer1 = Buffer.from('test1');
      const buffer2 = Buffer.from('test2');
      const hash1 = calculateHash(buffer1);
      const hash2 = calculateHash(buffer2);

      blobStorage.saveBlob(buffer1, hash1, 'image/jpeg');
      blobStorage.saveBlob(buffer2, hash2, 'image/png');

      blobStorage.deleteBlob(hash1, 'jpg');

      expect(blobStorage.blobExists(hash1, 'jpg')).toBe(false);
      expect(blobStorage.blobExists(hash2, 'png')).toBe(true);
    });
  });

  describe('Blob size', () => {
    it('should return correct size', () => {
      const buffer = Buffer.alloc(2048);
      const hash = calculateHash(buffer);
      blobStorage.saveBlob(buffer, hash, 'image/jpeg');

      const size = blobStorage.getBlobSize(hash, 'jpg');
      expect(size).toBe(2048);
    });

    it('should return null for non-existent blob', () => {
      const size = blobStorage.getBlobSize('nonexistent', 'jpg');
      expect(size).toBeNull();
    });
  });

  describe('Blob list operations', () => {
    it('should list all blobs', () => {
      const buffers = [
        Buffer.from('test1'),
        Buffer.from('test2'),
        Buffer.from('test3'),
      ];

      const hashes = buffers.map(b => calculateHash(b));

      blobStorage.saveBlob(buffers[0], hashes[0], 'image/jpeg');
      blobStorage.saveBlob(buffers[1], hashes[1], 'image/png');
      blobStorage.saveBlob(buffers[2], hashes[2], 'video/mp4');

      const blobs = blobStorage.listBlobs();
      expect(blobs.length).toBe(3);

      const blobHashes = blobs.map(b => b.hash);
      expect(blobHashes).toContain(hashes[0]);
      expect(blobHashes).toContain(hashes[1]);
      expect(blobHashes).toContain(hashes[2]);
    });

    it('should return empty array for no blobs', () => {
      const blobs = blobStorage.listBlobs();
      expect(blobs).toEqual([]);
    });

    it('should include correct metadata', () => {
      const buffer = Buffer.from('test');
      const hash = calculateHash(buffer);
      blobStorage.saveBlob(buffer, hash, 'image/jpeg');

      const blobs = blobStorage.listBlobs();
      const blob = blobs.find(b => b.hash === hash);

      expect(blob?.ext).toBe('jpg');
      expect(blob?.size).toBe(buffer.length);
      expect(blob?.path).toBe(blobStorage.getBlobPath(hash, 'jpg'));
    });
  });

  describe('Path operations', () => {
    it('should return correct blob path', () => {
      const path = blobStorage.getBlobPath('abc123', 'jpg');
      expect(path).toContain('blobs');
      expect(path).toContain('abc123.jpg');
    });

    it('should return correct blobs directory', () => {
      const blobsPath = blobStorage.getBlobsPath();
      expect(blobsPath).toBe(path.join(testWorkspace, 'blobs'));
    });
  });
});