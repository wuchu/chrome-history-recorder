/**
 * Extension Background - File Manager
 *
 * Coordinates file operations through VFS WebSocket Client.
 */

import { getVFSWebSocketClient, VFSFileMetadata } from './vfs-ws-client';

/**
 * HTTP Server base URL for thumbnail and file access
 */
const HTTP_BASE_URL = 'http://localhost:8766';

/**
 * Event types
 */
export type FileEventType =
  | 'file:captured'
  | 'file:trashed'
  | 'file:restored'
  | 'file:purged'
  | 'trash:emptied'
  | 'trash:restored-all'
  | 'file:classified'
  | 'vfs:connected'
  | 'vfs:disconnected'
  | 'ollama:status'
  | 'classify:queued'
  | 'classify:started'
  | 'classify:complete'
  | 'classify:failed'
  | 'classify:skipped'
  | 'classify:scheduler'
  | 'task:queued'
  | 'task:started'
  | 'task:completed'
  | 'task:retrying'
  | 'task:failed'
  | 'task:skipped'
  | 'task:scheduler'
  | 'rename:started'
  | 'rename:complete'
  | 'rename:failed'
  | 'rename:skipped'
  | 'tags:updated'
  | 'queue:updated';

/**
 * Event data
 */
export interface FileEventData {
  hash?: string;
  mimeType?: string;
  size?: number;
  category?: string;
  ai_filename?: string;
  duplicate?: boolean;
  available?: boolean;
  error?: string;
  pending?: number;
  processing?: number;
  completed?: number;
  failed?: number;
  priority?: number;
  confidence?: number;
  tags?: string[];
  classified_at?: string;
  model_used?: string;
  scheduler?: unknown;
  state?: string;
  running?: boolean;
  concurrency?: number;
}

/**
 * File Manager class
 */
export class FileManager {
  private vfsWsClient = getVFSWebSocketClient();

  constructor() {
    console.log('[FileManager] Constructor called, getting VFS WebSocket Client singleton');
    this.setupCallbacks();
    console.log('[FileManager] Callbacks setup complete');
  }

  /**
   * Setup VFS WebSocket Client callbacks
   */
  private setupCallbacks(): void {
    console.log('[FileManager] Setting up VFS WebSocket Client callbacks...');

    this.vfsWsClient.onConnect(() => {
      console.log('[FileManager] ✓ VFS WebSocket onConnect callback triggered!');
      console.log('[FileManager] Broadcasting vfs:connected event to DevTools Panel');
      this.broadcastEvent('vfs:connected', {});
    });

    this.vfsWsClient.onDisconnect((error) => {
      console.log('[FileManager] ✗ VFS WebSocket onDisconnect callback triggered, error:', error);
      console.log('[FileManager] Broadcasting vfs:disconnected event to DevTools Panel');
      this.broadcastEvent('vfs:disconnected', { error });
    });

    console.log('[FileManager] VFS WebSocket Client callbacks registered');
  }

  /**
   * Handle capture:media message from Content Script
   */
  async handleCaptureMedia(data: {
    buffer: ArrayBuffer | number[];
    mimeType: string;
    url: string;
    capturedAt?: string;
  }): Promise<{ hash: string; duplicate: boolean }> {
    try {
      const bufferSize = Array.isArray(data.buffer) ? data.buffer.length : data.buffer.byteLength;
      console.log(`[FileManager] Capturing media: ${data.mimeType}, ${bufferSize} bytes`);
      if (bufferSize === 0) {
        throw new Error('Cannot capture empty media buffer');
      }

      const result = await this.vfsWsClient.saveFile({
        buffer: data.buffer,
        mimeType: data.mimeType,
        sourceUrl: data.url,
        capturedAt: data.capturedAt ?? new Date().toISOString(),
      });

      if (result.duplicate) {
        console.log(`[FileManager] Duplicate media skipped: ${result.hash}`);
        return result;
      }

      // The app broadcasts file:captured when it stores the file; the
      // extension relays that event to the UI.
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[FileManager] Capture failed:', message);
      throw error;
    }
  }

  /**
   * Handle list files request from DevTools Panel
   */
  async handleListFiles(query?: {
    category?: string;
    tag?: string;
    q?: string;
    mimeType?: 'image' | 'video';
    sourceDomain?: string;
    capturedFrom?: string;
    capturedTo?: string;
    starred?: boolean;
    classifyStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
    tags?: string[];
    tagMode?: 'and' | 'or';
    limit?: number;
    offset?: number;
    cursor?: string;
    orderBy?:
      | 'captured_at'
      | 'size'
      | 'confidence'
      | 'ai_filename'
      | 'category'
      | 'classified_at'
      | 'deleted_at';
    order?: 'asc' | 'desc';
    status?: 'active' | 'trashed' | 'all';
  }): Promise<{
    items: VFSFileMetadata[];
    total: number;
    hasMore: boolean;
    nextCursor?: string;
  }> {
    return this.vfsWsClient.listFiles(query);
  }

  /**
   * Move a file to the recycle bin.
   */
  async handleTrashFile(hash: string): Promise<{ success: boolean }> {
    // The app broadcasts file:trashed; the extension relays it.
    return this.vfsWsClient.trashFile(hash);
  }

  /**
   * Restore a file from the recycle bin.
   */
  async handleRestoreFile(hash: string): Promise<{ success: boolean }> {
    return this.vfsWsClient.restoreFile(hash);
  }

  /**
   * Restore every trashed file.
   */
  async handleRestoreAll(): Promise<{ success: boolean; count: number }> {
    return this.vfsWsClient.restoreAll();
  }

  /**
   * Permanently delete a file.
   */
  async handlePurgeFile(hash: string): Promise<{ success: boolean }> {
    return this.vfsWsClient.purgeFile(hash);
  }

  /**
   * Permanently delete every trashed file.
   */
  async handleEmptyTrash(): Promise<{ success: boolean; count: number }> {
    return this.vfsWsClient.emptyTrash();
  }

  /**
   * Get thumbnail URL for DevTools Panel (HTTP URL)
   */
  getThumbnailUrl(hash: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
    return `${HTTP_BASE_URL}/files/${hash}/thumbnail?size=${size}`;
  }

  /**
   * Get file download URL
   */
  getFileUrl(hash: string): string {
    return `${HTTP_BASE_URL}/files/${hash}`;
  }

  /**
   * Broadcast event to all connected DevTools Panels
   */
  broadcastEvent(type: FileEventType | string, data: unknown): void {
    console.log(`[FileManager] Broadcasting event: ${type}`, data);
    chrome.runtime
      .sendMessage({
        type,
        data,
        timestamp: new Date().toISOString(),
      })
      .catch((error) => {
        console.log('[FileManager] Broadcast failed (no listeners):', error);
        // Ignore errors (no listeners)
      });
  }

  /**
   * Get file stats
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    images: number;
    videos: number;
    byCategory: Record<string, number>;
  }> {
    return this.vfsWsClient.getStats();
  }

  /**
   * Get VFS connection status
   */
  isConnected(): boolean {
    return this.vfsWsClient.isConnected();
  }
}

// Singleton instance
let fileManager: FileManager | null = null;

/**
 * Get File Manager singleton
 */
export function getFileManager(): FileManager {
  if (!fileManager) {
    fileManager = new FileManager();
  }
  return fileManager;
}

/**
 * Initialize File Manager
 */
export function initFileManager(): FileManager {
  fileManager = new FileManager();
  return fileManager;
}
