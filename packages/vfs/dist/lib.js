"use strict";
/**
 * VFS Library Entry
 *
 * Stable library surface consumed by the app. The transport servers are
 * exported so the app can start them, while `VFSAPI` remains the file and
 * task contract shared by the app's scheduler, the AI package, and the
 * extension over WebSocket/HTTP.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandPath = exports.getDefaultWorkspacePath = exports.parseArgs = exports.DEFAULT_ASSEMBLY_MAX_BYTES = exports.AssemblyUnauthorizedError = exports.AssemblyNotFoundError = exports.AssemblyInvalidError = exports.AssemblyIncompleteError = exports.AssemblyCapacityError = exports.AssemblyManager = exports.DEFAULT_MAX_UPLOAD_SIZE = exports.createHTTPServer = exports.VFSHTTPServer = exports.createWebSocketServer = exports.VFSSWebSocketServer = exports.createDispatcher = exports.ThumbnailStorage = exports.getMimeTypeFromExtension = exports.getExtensionFromMimeType = exports.calculateHash = exports.BlobStorage = exports.ensureWorkspace = exports.SQLiteDatabase = exports.InvalidMediaError = exports.UploadEmptyError = exports.UploadTooLargeError = exports.VFSAPI = void 0;
var api_1 = require("./api");
Object.defineProperty(exports, "VFSAPI", { enumerable: true, get: function () { return api_1.VFSAPI; } });
Object.defineProperty(exports, "UploadTooLargeError", { enumerable: true, get: function () { return api_1.UploadTooLargeError; } });
Object.defineProperty(exports, "UploadEmptyError", { enumerable: true, get: function () { return api_1.UploadEmptyError; } });
Object.defineProperty(exports, "InvalidMediaError", { enumerable: true, get: function () { return api_1.InvalidMediaError; } });
var sqlite_1 = require("./sqlite");
Object.defineProperty(exports, "SQLiteDatabase", { enumerable: true, get: function () { return sqlite_1.SQLiteDatabase; } });
Object.defineProperty(exports, "ensureWorkspace", { enumerable: true, get: function () { return sqlite_1.ensureWorkspace; } });
var blob_1 = require("./blob");
Object.defineProperty(exports, "BlobStorage", { enumerable: true, get: function () { return blob_1.BlobStorage; } });
Object.defineProperty(exports, "calculateHash", { enumerable: true, get: function () { return blob_1.calculateHash; } });
Object.defineProperty(exports, "getExtensionFromMimeType", { enumerable: true, get: function () { return blob_1.getExtensionFromMimeType; } });
Object.defineProperty(exports, "getMimeTypeFromExtension", { enumerable: true, get: function () { return blob_1.getMimeTypeFromExtension; } });
var thumbnail_1 = require("./thumbnail");
Object.defineProperty(exports, "ThumbnailStorage", { enumerable: true, get: function () { return thumbnail_1.ThumbnailStorage; } });
var dispatcher_1 = require("./dispatcher");
Object.defineProperty(exports, "createDispatcher", { enumerable: true, get: function () { return dispatcher_1.createDispatcher; } });
var websocket_server_1 = require("./websocket-server");
Object.defineProperty(exports, "VFSSWebSocketServer", { enumerable: true, get: function () { return websocket_server_1.VFSSWebSocketServer; } });
Object.defineProperty(exports, "createWebSocketServer", { enumerable: true, get: function () { return websocket_server_1.createWebSocketServer; } });
var http_server_1 = require("./http-server");
Object.defineProperty(exports, "VFSHTTPServer", { enumerable: true, get: function () { return http_server_1.VFSHTTPServer; } });
Object.defineProperty(exports, "createHTTPServer", { enumerable: true, get: function () { return http_server_1.createHTTPServer; } });
Object.defineProperty(exports, "DEFAULT_MAX_UPLOAD_SIZE", { enumerable: true, get: function () { return http_server_1.DEFAULT_MAX_UPLOAD_SIZE; } });
var assembly_1 = require("./assembly");
Object.defineProperty(exports, "AssemblyManager", { enumerable: true, get: function () { return assembly_1.AssemblyManager; } });
Object.defineProperty(exports, "AssemblyCapacityError", { enumerable: true, get: function () { return assembly_1.AssemblyCapacityError; } });
Object.defineProperty(exports, "AssemblyIncompleteError", { enumerable: true, get: function () { return assembly_1.AssemblyIncompleteError; } });
Object.defineProperty(exports, "AssemblyInvalidError", { enumerable: true, get: function () { return assembly_1.AssemblyInvalidError; } });
Object.defineProperty(exports, "AssemblyNotFoundError", { enumerable: true, get: function () { return assembly_1.AssemblyNotFoundError; } });
Object.defineProperty(exports, "AssemblyUnauthorizedError", { enumerable: true, get: function () { return assembly_1.AssemblyUnauthorizedError; } });
Object.defineProperty(exports, "DEFAULT_ASSEMBLY_MAX_BYTES", { enumerable: true, get: function () { return assembly_1.DEFAULT_ASSEMBLY_MAX_BYTES; } });
var config_1 = require("./config");
Object.defineProperty(exports, "parseArgs", { enumerable: true, get: function () { return config_1.parseArgs; } });
Object.defineProperty(exports, "getDefaultWorkspacePath", { enumerable: true, get: function () { return config_1.getDefaultWorkspacePath; } });
Object.defineProperty(exports, "expandPath", { enumerable: true, get: function () { return config_1.expandPath; } });
//# sourceMappingURL=lib.js.map