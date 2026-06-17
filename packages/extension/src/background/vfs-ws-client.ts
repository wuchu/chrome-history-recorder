/**
 * VFS WebSocket Client
 *
 * Communicates with VFS Service via WebSocket connection.
 */

/**
 * VFS WebSocket Client configuration
 */
export interface VFSWebSocketClientConfig {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  requestTimeout?: number;
}

/**
 * VFS Response type
 */
export interface VFSResponse<T = unknown> {
  id?: number;
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * VFS File metadata
 */
export interface VFSFileMetadata {
  hash: string;
  blob_ext: string;
  mime_type: string;
  size: number;
  source_url: string | null;
  captured_at: string;
  category: string;
  ai_filename: string | null;
  tags: string | null;
  confidence: number;
  classified_at: string | null;
  model_used: string | null;
  is_starred: number;
  user_notes: string | null;
  is_deleted: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * VFS List query
 */
export interface VFSListQuery {
  category?: string;
  tag?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'captured_at' | 'category' | 'classified_at';
  order?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

/**
 * VFS Queue status
 */
export interface VFSQueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export interface SyncBlobsToIndexResult {
  scanned: number;
  indexed: number;
  skippedExisting: number;
  skippedUnsupported: number;
  skippedInvalidHash: number;
  errors: Array<{ path: string; reason: string }>;
}

/**
 * WebSocket connection state
 */
export type ConnectionState = 'connected' | 'connecting' | 'disconnected';

/**
 * VFS WebSocket Client class
 */
export class VFSWebSocketClient {
  private url: string;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private requestTimeout: number;
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts: number = 0;
  private pendingRequests: Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
    }
  > = new Map();
  private nextRequestId: number = 0;
  private onDisconnectCallbacks: Array<(error: string) => void> = [];
  private onConnectCallbacks: Array<() => void> = [];
  private onEventCallbacks: Array<(event: string, data: unknown) => void> = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: VFSWebSocketClientConfig = {}) {
    this.url = config.url ?? 'ws://localhost:8765';
    this.reconnectInterval = config.reconnectInterval ?? 5000;
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 10;
    this.requestTimeout = config.requestTimeout ?? 30000;
  }

  /**
   * Connect to WebSocket Server
   */
  connect(): void {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return;
    }

    this.connectionState = 'connecting';
    this.clearReconnectTimer();

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.handleConnect();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        this.handleDisconnect('WebSocket closed');
      };

      this.ws.onerror = (error) => {
        console.error('[VFSWebSocketClient] WebSocket error:', error);
        this.handleDisconnect('WebSocket error');
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[VFSWebSocketClient] Connection failed:', message);
      this.handleDisconnect(message);
    }
  }

  /**
   * Disconnect from WebSocket Server
   */
  disconnect(): void {
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionState = 'disconnected';
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected' && this.ws !== null;
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Send message to WebSocket Server
   */
  async send<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.isConnected() || !this.ws) {
      throw new Error('VFS WebSocket Client not connected');
    }

    const id = this.nextRequestId++;
    const request = { id, method, params };

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: (value: unknown) => resolve(value as T),
        reject,
      });
      this.ws!.send(JSON.stringify(request));

      // Timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, this.requestTimeout);
    });
  }

  /**
   * Handle WebSocket connect
   */
  private handleConnect(): void {
    const previousState = this.connectionState;
    this.connectionState = 'connected';
    this.reconnectAttempts = 0;
    const timestamp = new Date().toISOString();
    console.log(`[VFSWebSocketClient] ✓ Connected at ${timestamp}`);
    console.log(`[VFSWebSocketClient] Connection state changed: ${previousState} -> connected`);
    console.log(
      `[VFSWebSocketClient] Triggering ${this.onConnectCallbacks.length} onConnect callback(s)...`
    );
    for (const callback of this.onConnectCallbacks) {
      callback();
    }
    console.log(`[VFSWebSocketClient] onConnect callbacks triggered`);
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle connection confirmation
      if (message.type === 'connected') {
        console.log('[VFSWebSocketClient] Connection confirmed:', message.timestamp);
        return;
      }

      // Handle heartbeat
      if (message.type === 'heartbeat') {
        return;
      }

      // Handle events
      if (message.type === 'event') {
        for (const callback of this.onEventCallbacks) {
          callback(message.event, message.data);
        }
        return;
      }

      // Handle API response
      const id = message.id;
      if (id === undefined) return;

      const pending = this.pendingRequests.get(id);
      if (!pending) return;

      this.pendingRequests.delete(id);

      if (message.success) {
        pending.resolve(message.data);
      } else {
        pending.reject(new Error(message.error ?? 'Unknown error'));
      }
    } catch (error) {
      console.error('[VFSWebSocketClient] Message parse error:', error);
    }
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(reason: string): void {
    const previousState = this.connectionState;
    this.connectionState = 'disconnected';
    this.ws = null;

    const timestamp = new Date().toISOString();
    console.error(`[VFSWebSocketClient] Disconnected at ${timestamp}: ${reason}`);
    console.log(`[VFSWebSocketClient] Connection state changed: ${previousState} -> disconnected`);
    console.log(
      `[VFSWebSocketClient] Triggering ${this.onDisconnectCallbacks.length} onDisconnect callback(s)...`
    );
    for (const callback of this.onDisconnectCallbacks) {
      callback(reason);
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error('WebSocket disconnected'));
      this.pendingRequests.delete(id);
    }

    // Schedule reconnect
    this.scheduleReconnect();
  }

  /**
   * Schedule reconnect
   */
  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[VFSWebSocketClient] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `[VFSWebSocketClient] Reconnecting in ${this.reconnectInterval}ms (attempt ${this.reconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Add disconnect callback
   */
  onDisconnect(callback: (error: string) => void): void {
    this.onDisconnectCallbacks.push(callback);
    console.log(
      `[VFSWebSocketClient] Added onDisconnect callback, total: ${this.onDisconnectCallbacks.length}`
    );
  }

  /**
   * Add connect callback
   */
  onConnect(callback: () => void): void {
    this.onConnectCallbacks.push(callback);
    console.log(
      `[VFSWebSocketClient] Added onConnect callback, total: ${this.onConnectCallbacks.length}`
    );
  }

  /**
   * Add event callback
   */
  onEvent(callback: (event: string, data: unknown) => void): void {
    this.onEventCallbacks.push(callback);
    console.log(
      `[VFSWebSocketClient] Added onEvent callback, total: ${this.onEventCallbacks.length}`
    );
  }

  // API Methods (same signature as VFSClient)

  /**
   * Save file
   */
  async saveFile(params: {
    buffer: ArrayBuffer | number[];
    mimeType: string;
    sourceUrl?: string;
    capturedAt?: string;
  }): Promise<{ hash: string; duplicate: boolean; size: number }> {
    // Convert binary data to number[] for JSON serialization.
    const bufferArray = Array.isArray(params.buffer)
      ? params.buffer
      : Array.from(new Uint8Array(params.buffer));
    console.log(
      `[VFSWebSocketClient] Sending saveFile: ${params.mimeType}, ${bufferArray.length} bytes`
    );
    return this.send('saveFile', {
      buffer: bufferArray,
      mimeType: params.mimeType,
      sourceUrl: params.sourceUrl,
      capturedAt: params.capturedAt,
    });
  }

  /**
   * Get file
   */
  async getFile(hash: string): Promise<{
    buffer: number[] | { type?: string; data?: number[] };
    mimeType: string;
    size: number;
    metadata: VFSFileMetadata;
  } | null> {
    return this.send('getFile', { hash });
  }

  /**
   * Delete file
   */
  async deleteFile(hash: string, hard?: boolean): Promise<{ success: boolean }> {
    return this.send('deleteFile', { hash, hard });
  }

  /**
   * List files
   */
  async listFiles(query?: VFSListQuery): Promise<{
    items: VFSFileMetadata[];
    total: number;
    hasMore: boolean;
  }> {
    return this.send('listFiles', { ...(query ?? {}) });
  }

  /**
   * Update metadata
   */
  async updateMetadata(
    hash: string,
    updates: Partial<VFSFileMetadata>
  ): Promise<{
    success: boolean;
    updatedMetadata?: VFSFileMetadata;
  }> {
    return this.send('updateMetadata', { hash, updates });
  }

  /**
   * Get metadata
   */
  async getMetadata(hash: string): Promise<VFSFileMetadata | null> {
    return this.send('getMetadata', { hash });
  }

  /**
   * Get thumbnail
   */
  async getThumbnail(
    hash: string,
    size?: 'small' | 'medium' | 'large'
  ): Promise<{
    buffer: number[] | { type?: string; data?: number[] };
    mimeType: string;
  } | null> {
    return this.send('getThumbnail', { hash, size });
  }

  /**
   * Get stats
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    images: number;
    videos: number;
    byCategory: Record<string, number>;
  }> {
    return this.send('getStats');
  }

  /**
   * Get workspace config
   */
  async getWorkspaceConfig(): Promise<{ path: string }> {
    return this.send('getWorkspaceConfig');
  }

  /**
   * Sync existing workspace blobs into the VFS index
   */
  async syncBlobsToIndex(): Promise<SyncBlobsToIndexResult> {
    return this.send('syncBlobsToIndex');
  }

  /**
   * Enqueue classification
   */
  async enqueueClassification(hash: string, priority?: number): Promise<{ success: boolean }> {
    return this.send('enqueueClassification', { hash, priority });
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<VFSQueueStatus> {
    return this.send('getQueueStatus');
  }

  /**
   * Get pending tasks
   */
  async getPendingTasks(limit?: number): Promise<
    Array<{
      hash: string;
      status: string;
      priority: number;
    }>
  > {
    return this.send('getPendingTasks', { limit });
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    hash: string,
    status: string,
    error?: string
  ): Promise<{ success: boolean }> {
    return this.send('updateTaskStatus', { hash, status, error });
  }

  /**
   * Retry failed tasks
   */
  async retryFailedTasks(): Promise<{ count: number }> {
    return this.send('retryFailedTasks');
  }

  /**
   * Clear queue
   */
  async clearQueue(): Promise<{ success: boolean }> {
    return this.send('clearQueue');
  }

  /**
   * Get tag counts
   */
  async getTagCounts(): Promise<Record<string, number>> {
    return this.send('getTagCounts');
  }

  /**
   * Clear index
   */
  async clearIndex(): Promise<{ success: boolean }> {
    return this.send('clearIndex');
  }
}

// Singleton instance
let vfsWebSocketClient: VFSWebSocketClient | null = null;

/**
 * Get VFS WebSocket Client singleton
 */
export function getVFSWebSocketClient(): VFSWebSocketClient {
  if (!vfsWebSocketClient) {
    console.log('[VFSWebSocketClient] Creating new singleton instance (via getVFSWebSocketClient)');
    vfsWebSocketClient = new VFSWebSocketClient();
  }
  console.log(
    '[VFSWebSocketClient] Returning singleton instance, connected:',
    vfsWebSocketClient.isConnected()
  );
  return vfsWebSocketClient;
}

/**
 * Initialize VFS WebSocket Client
 */
export function initVFSWebSocketClient(config?: VFSWebSocketClientConfig): VFSWebSocketClient {
  console.log(
    '[VFSWebSocketClient] initVFSWebSocketClient called, creating new singleton instance'
  );
  vfsWebSocketClient = new VFSWebSocketClient(config);
  console.log('[VFSWebSocketClient] Singleton instance created, connecting...');
  vfsWebSocketClient.connect();
  console.log('[VFSWebSocketClient] connect() called');
  return vfsWebSocketClient;
}
