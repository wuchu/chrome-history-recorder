"use strict";
/**
 * VFS Service - Message Dispatcher Module
 *
 * Routes WebSocket requests to appropriate API handlers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSuccessResponse = createSuccessResponse;
exports.createErrorResponse = createErrorResponse;
exports.createDispatcher = createDispatcher;
/**
 * Create success response
 */
function createSuccessResponse(data, id) {
    return {
        id,
        success: true,
        data,
    };
}
/**
 * Create error response
 */
function createErrorResponse(error, id) {
    return {
        id,
        success: false,
        error,
    };
}
/**
 * Create message dispatcher
 */
function createDispatcher(api) {
    return async (request) => {
        const { id, method, params = {} } = request;
        try {
            const result = await dispatchMethod(api, method, params);
            return createSuccessResponse(result, id);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return createErrorResponse(message, id);
        }
    };
}
/**
 * Dispatch method to API handler
 */
async function dispatchMethod(api, method, params) {
    switch (method) {
        // File operations
        case 'saveFile':
            return api.saveFile(params);
        case 'getFile':
            return api.getFile(params.hash);
        case 'deleteFile':
            return api.deleteFile(params);
        case 'listFiles':
            return api.listFiles(params);
        // Metadata operations
        case 'updateMetadata':
            return api.updateMetadata(params);
        case 'getMetadata':
            return api.getMetadata(params.hash);
        // Thumbnail operations
        case 'getThumbnail':
            return api.getThumbnail(params);
        // Stats operations
        case 'getStats':
            return api.getStats();
        // Config operations
        case 'getWorkspaceConfig':
            return api.getWorkspaceConfig();
        case 'syncBlobsToIndex':
            return api.syncBlobsToIndex();
        case 'setWorkspaceConfig':
            return api.setWorkspaceConfig();
        // Classification queue operations
        case 'enqueueClassification':
            return api.enqueueClassification(params);
        case 'getQueueStatus':
            return api.getQueueStatus();
        case 'getPendingTasks':
            return api.getPendingTasks(params.limit);
        case 'updateTaskStatus':
            return api.updateTaskStatus(params);
        case 'retryFailedTasks':
            return api.retryFailedTasks();
        case 'clearQueue':
            return api.clearQueue();
        case 'getTagCounts':
            return api.getTagCounts();
        case 'clearIndex':
            return api.clearIndex();
        default:
            throw new Error(`Unknown method: ${method}`);
    }
}
//# sourceMappingURL=dispatcher.js.map