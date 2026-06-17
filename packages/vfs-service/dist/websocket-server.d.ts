/**
 * VFS Service - WebSocket Server Module
 *
 * Provides WebSocket endpoint for API calls and real-time events.
 */
import { VFSAPI } from './api';
/**
 * WebSocket Server configuration
 */
export interface WebSocketServerConfig {
    port: number;
    host?: string;
}
/**
 * WebSocket Server class
 */
export declare class VFSSWebSocketServer {
    private server;
    private api;
    private dispatcher;
    private clients;
    private heartbeatInterval;
    private port;
    private workspacePath;
    constructor(api: VFSAPI, workspacePath: string, config: WebSocketServerConfig);
    /**
     * Setup WebSocket server handlers
     */
    private setupServer;
    /**
     * Handle new WebSocket connection
     */
    private handleConnection;
    /**
     * Handle WebSocket message
     */
    private handleMessage;
    /**
     * Handle WebSocket disconnect
     */
    private handleDisconnect;
    /**
     * Send message to WebSocket client
     */
    private sendMessage;
    /**
     * Broadcast message to all connected clients
     */
    broadcast(message: unknown): void;
    /**
     * Start heartbeat mechanism
     */
    private startHeartbeat;
    /**
     * Stop heartbeat mechanism
     */
    private stopHeartbeat;
    /**
     * Close WebSocket server
     */
    close(): void;
    /**
     * Get connected clients count
     */
    getClientCount(): number;
}
/**
 * Create WebSocket server
 */
export declare function createWebSocketServer(api: VFSAPI, workspacePath: string, config: WebSocketServerConfig): VFSSWebSocketServer;
//# sourceMappingURL=websocket-server.d.ts.map