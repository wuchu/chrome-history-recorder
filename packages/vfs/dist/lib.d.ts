/**
 * VFS Library Entry
 *
 * Stable library surface consumed by the app. The transport servers are
 * exported so the app can start them, while `VFSAPI` remains the file and
 * task contract shared by the app's scheduler, the AI package, and the
 * extension over WebSocket/HTTP.
 */
export { VFSAPI, UploadTooLargeError, UploadEmptyError, InvalidMediaError, type SaveFileResult, type BlobPathInfo, type SyncBlobsToIndexError, type SyncBlobsToIndexResult, } from './api';
export { SQLiteDatabase, ensureWorkspace, type FileMetadata, type MetadataUpdate, type ListQuery, type ListFilesCreatedAfterParams, type EnqueueTaskParams, type TaskType, type TaskStatus, type TaskItem, type QueueStatus, type TagRecord, type ApplyClassificationParams, } from './sqlite';
export { BlobStorage, calculateHash, getExtensionFromMimeType, getMimeTypeFromExtension, } from './blob';
export { ThumbnailStorage, type ThumbnailSize } from './thumbnail';
export { createDispatcher, type VFSRequest, type VFSResponse, type ExternalHandler, } from './dispatcher';
export { VFSSWebSocketServer, createWebSocketServer, type WebSocketServerConfig, } from './websocket-server';
export { VFSHTTPServer, createHTTPServer, DEFAULT_MAX_UPLOAD_SIZE, type HTTPServerConfig, } from './http-server';
export { parseArgs, getDefaultWorkspacePath, expandPath, type VFSConfig, type WorkspaceSource, } from './config';
//# sourceMappingURL=lib.d.ts.map