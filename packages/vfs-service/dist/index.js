"use strict";
/**
 * VFS Service - Main Entry Point
 *
 * WebSocket + HTTP Server for Chrome Extension.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite_1 = require("./sqlite");
const blob_1 = require("./blob");
const thumbnail_1 = require("./thumbnail");
const api_1 = require("./api");
const websocket_server_1 = require("./websocket-server");
const http_server_1 = require("./http-server");
const config_1 = require("./config");
/**
 * WebSocket Server port (default: 8765)
 */
const WEBSOCKET_PORT = process.env.VFS_WS_PORT ? parseInt(process.env.VFS_WS_PORT) : 8765;
/**
 * HTTP Server port (default: 8766)
 */
const HTTP_PORT = process.env.VFS_HTTP_PORT ? parseInt(process.env.VFS_HTTP_PORT) : 8766;
/**
 * Main entry point
 */
async function main() {
    // Parse configuration
    const config = (0, config_1.parseArgs)(process.argv.slice(2));
    // Ensure workspace exists
    (0, sqlite_1.ensureWorkspace)(config.workspacePath);
    // Initialize components
    const db = new sqlite_1.SQLiteDatabase(config.workspacePath);
    const blobStorage = new blob_1.BlobStorage(config.workspacePath);
    const thumbnailStorage = new thumbnail_1.ThumbnailStorage(config.workspacePath);
    const api = new api_1.VFSAPI(db, blobStorage, thumbnailStorage, config.workspacePath);
    // Start WebSocket Server
    const wsServer = (0, websocket_server_1.createWebSocketServer)(api, config.workspacePath, {
        port: WEBSOCKET_PORT,
    });
    // Start HTTP Server
    const httpServer = (0, http_server_1.createHTTPServer)(api, {
        port: HTTP_PORT,
    });
    // Log startup
    console.error(`VFS Service started`);
    console.error(`Workspace: ${config.workspacePath}`);
    console.error(`WebSocket: ws://localhost:${WEBSOCKET_PORT}`);
    console.error(`HTTP: http://localhost:${HTTP_PORT}`);
    // Graceful shutdown handler
    const shutdown = () => {
        console.error('\nShutting down VFS Service...');
        wsServer.close();
        httpServer.close();
        db.close();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    // Keep process alive (WebSocket and HTTP servers are running)
    await new Promise(() => { });
}
// Start service
main().catch((error) => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map