/**
 * VFS Service - Blob Storage Module
 *
 * Manages physical blob storage with content-addressable naming.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * MIME type to extension mapping
 */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/ogg': 'ogv',
  'video/x-matroska': 'mkv',
};

/**
 * Extension to MIME type mapping
 */
const EXT_TO_MIME: Record<string, string> = {
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'bmp': 'image/bmp',
  'tiff': 'image/tiff',
  'svg': 'image/svg+xml',
  'ico': 'image/x-icon',
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'mov': 'video/quicktime',
  'avi': 'video/x-msvideo',
  'ogv': 'video/ogg',
  'mkv': 'video/x-matroska',
};

/**
 * Calculate SHA-256 hash and truncate to 16 characters
 */
export function calculateHash(buffer: Buffer): string {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  return hash.substring(0, 16);
}

/**
 * Get extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  return MIME_TO_EXT[mimeType] || 'bin';
}

/**
 * Get MIME type from extension
 */
export function getMimeTypeFromExtension(ext: string): string {
  return EXT_TO_MIME[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Blob storage class
 */
export class BlobStorage {
  private blobsPath: string;

  constructor(workspacePath: string) {
    this.blobsPath = path.join(workspacePath, 'blobs');
  }

  /**
   * Get blob file path
   */
  getBlobPath(hash: string, ext: string): string {
    return path.join(this.blobsPath, `${hash}.${ext}`);
  }

  /**
   * Save blob to storage
   * Returns true if file was saved, false if duplicate
   */
  saveBlob(buffer: Buffer, hash: string, mimeType: string): { saved: boolean; ext: string; size: number } {
    const ext = getExtensionFromMimeType(mimeType);
    const filePath = this.getBlobPath(hash, ext);

    // Check if file already exists (duplicate)
    if (fs.existsSync(filePath)) {
      return { saved: false, ext, size: buffer.length };
    }

    // Write file
    fs.writeFileSync(filePath, buffer, { mode: 0o644 });
    return { saved: true, ext, size: buffer.length };
  }

  /**
   * Read blob from storage
   */
  readBlob(hash: string, ext: string): Buffer | null {
    const filePath = this.getBlobPath(hash, ext);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath);
  }

  /**
   * Check if blob exists
   */
  blobExists(hash: string, ext: string): boolean {
    const filePath = this.getBlobPath(hash, ext);
    return fs.existsSync(filePath);
  }

  /**
   * Delete blob from storage
   */
  deleteBlob(hash: string, ext: string): boolean {
    const filePath = this.getBlobPath(hash, ext);
    if (!fs.existsSync(filePath)) {
      return false;
    }
    fs.unlinkSync(filePath);
    return true;
  }

  /**
   * Get blob size
   */
  getBlobSize(hash: string, ext: string): number | null {
    const filePath = this.getBlobPath(hash, ext);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const stat = fs.statSync(filePath);
    return stat.size;
  }

  /**
   * List all blobs
   */
  listBlobs(): Array<{ hash: string; ext: string; path: string; size: number }> {
    const files = fs.readdirSync(this.blobsPath);
    const blobs: Array<{ hash: string; ext: string; path: string; size: number }> = [];

    for (const file of files) {
      const filePath = path.join(this.blobsPath, file);
      const stat = fs.statSync(filePath);
      const parts = file.split('.');
      const hash = parts[0];
      const ext = parts.slice(1).join('.') || 'bin';

      blobs.push({
        hash,
        ext,
        path: filePath,
        size: stat.size,
      });
    }

    return blobs;
  }

  /**
   * Get blobs path
   */
  getBlobsPath(): string {
    return this.blobsPath;
  }
}