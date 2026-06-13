/**
 * VFS Service - Main Entry Point
 *
 * WebSocket + HTTP Server for Chrome Extension.
 */

import { SQLiteDatabase, ensureWorkspace } from './sqlite.js';
import { BlobStorage } from './blob.js';
import { ThumbnailStorage } from './thumbnail.js';
import { VFSAPI } from './api.js';
import { createWebSocketServer } from './websocket-server.js';
import { createHTTPServer } from './http-server.js';
import { parseArgs } from './config.js';

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
async function main(): Promise<void> {
  // Parse configuration
  const config = parseArgs(process.argv.slice(2));

  // Ensure workspace exists
  ensureWorkspace(config.workspacePath);

  // Initialize components
  const db = new SQLiteDatabase(config.workspacePath);
  const blobStorage = new BlobStorage(config.workspacePath);
  const thumbnailStorage = new ThumbnailStorage(config.workspacePath);
  const api = new VFSAPI(db, blobStorage, thumbnailStorage, config.workspacePath);

  // Start WebSocket Server
  const wsServer = createWebSocketServer(api, config.workspacePath, {
    port: WEBSOCKET_PORT,
  });

  // Start HTTP Server
  const httpServer = createHTTPServer(api, {
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
  await new Promise(() => {});
}

// Start service
main().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});