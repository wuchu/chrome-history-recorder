"use strict";
/**
 * VFS Service - WebSocket Server Module
 *
 * Provides WebSocket endpoint for API calls and real-time events.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VFSSWebSocketServer = void 0;
exports.createWebSocketServer = createWebSocketServer;
const ws_1 = require("ws");
const dispatcher_1 = require("./dispatcher");
/**
 * WebSocket Server class
 */
class VFSSWebSocketServer {
    server;
    api;
    dispatcher;
    clients = new Set();
    heartbeatInterval = null;
    port;
    workspacePath;
    constructor(api, workspacePath, config) {
        this.api = api;
        this.dispatcher = (0, dispatcher_1.createDispatcher)(api);
        this.port = config.port;
        this.workspacePath = workspacePath;
        // Create WebSocket server
        this.server = new ws_1.WebSocketServer({
            port: config.port,
            host: config.host || 'localhost',
        });
        this.setupServer();
        this.startHeartbeat();
    }
    /**
     * Setup WebSocket server handlers
     */
    setupServer() {
        this.server.on('connection', (ws) => {
            this.handleConnection(ws);
        });
        this.server.on('error', (error) => {
            console.error(`WebSocket Server error: ${error.message}`);
        });
        console.error(`WebSocket Server listening on port ${this.port}`);
    }
    /**
     * Handle new WebSocket connection
     */
    handleConnection(ws) {
        this.clients.add(ws);
        ws.pingReceived = true; // Initialize as true
        // Send connection confirmation
        this.sendMessage(ws, {
            type: 'connected',
            timestamp: new Date().toISOString(),
        });
        // Broadcast VFS connected event
        this.broadcast({
            type: 'event',
            event: 'vfs:connected',
            data: {
                version: '1.0.0',
                workspacePath: this.workspacePath,
            },
            timestamp: new Date().toISOString(),
        });
        // Setup message handler
        ws.on('message', (data) => {
            this.handleMessage(ws, data);
        });
        // Setup close handler
        ws.on('close', () => {
            this.handleDisconnect(ws);
        });
        // Setup error handler
        ws.on('error', (error) => {
            console.error(`WebSocket client error: ${error.message}`);
            this.handleDisconnect(ws);
        });
        // Setup pong handler for heartbeat
        ws.on('pong', () => {
            ws.pingReceived = true;
        });
        console.error(`WebSocket client connected (${this.clients.size} total)`);
    }
    /**
     * Handle WebSocket message
     */
    async handleMessage(ws, data) {
        try {
            const message = JSON.parse(data.toString());
            // Handle heartbeat response
            if (message.type === 'heartbeat') {
                ws.pingReceived = true;
                return;
            }
            // Handle API request
            if (message.id !== undefined && message.method) {
                const request = {
                    id: message.id,
                    method: message.method,
                    params: message.params || {},
                };
                const response = await this.dispatcher(request);
                // Send API response
                this.sendMessage(ws, {
                    id: response.id,
                    success: response.success,
                    data: response.data,
                    error: response.error,
                });
                // Broadcast events for certain operations
                if (response.success && message.method === 'deleteFile') {
                    this.broadcast({
                        type: 'event',
                        event: 'file:deleted',
                        data: {
                            hash: message.params?.hash,
                            hard: message.params?.hard || false,
                            deletedAt: new Date().toISOString(),
                        },
                        timestamp: new Date().toISOString(),
                    });
                }
                if (response.success && message.method === 'enqueueClassification') {
                    const queueStatus = this.api.getQueueStatus();
                    this.broadcast({
                        type: 'event',
                        event: 'queue:updated',
                        data: queueStatus,
                        timestamp: new Date().toISOString(),
                    });
                }
                if (response.success && message.method === 'updateTaskStatus') {
                    const queueStatus = this.api.getQueueStatus();
                    this.broadcast({
                        type: 'event',
                        event: 'queue:updated',
                        data: queueStatus,
                        timestamp: new Date().toISOString(),
                    });
                }
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`WebSocket message handling error: ${message}`);
            this.sendMessage(ws, {
                success: false,
                error: message,
            });
        }
    }
    /**
     * Handle WebSocket disconnect
     */
    handleDisconnect(ws) {
        this.clients.delete(ws);
        console.error(`WebSocket client disconnected (${this.clients.size} total)`);
    }
    /**
     * Send message to WebSocket client
     */
    sendMessage(ws, message) {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    /**
     * Broadcast message to all connected clients
     */
    broadcast(message) {
        const payload = JSON.stringify(message);
        for (const client of this.clients) {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(payload);
            }
        }
    }
    /**
     * Start heartbeat mechanism
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            for (const client of this.clients) {
                if (client.readyState === ws_1.WebSocket.OPEN) {
                    // Check if client responded to last ping
                    if (!client.pingReceived) {
                        // Client didn't respond, close connection
                        console.error('WebSocket client timeout, closing connection');
                        client.terminate();
                        this.clients.delete(client);
                    }
                    else {
                        // Reset for next heartbeat
                        client.pingReceived = false;
                        client.ping();
                    }
                }
            }
        }, 30000); // 30 seconds interval
    }
    /**
     * Stop heartbeat mechanism
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    /**
     * Close WebSocket server
     */
    close() {
        this.stopHeartbeat();
        // Close all client connections
        for (const client of this.clients) {
            client.close();
        }
        this.clients.clear();
        // Close server
        this.server.close();
        console.error('WebSocket Server closed');
    }
    /**
     * Get connected clients count
     */
    getClientCount() {
        return this.clients.size;
    }
}
exports.VFSSWebSocketServer = VFSSWebSocketServer;
/**
 * Create WebSocket server
 */
function createWebSocketServer(api, workspacePath, config) {
    return new VFSSWebSocketServer(api, workspacePath, config);
}
//# sourceMappingURL=websocket-server.js.map