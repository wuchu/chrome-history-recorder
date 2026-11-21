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
function createDispatcher(api, external) {
    return async (request) => {
        const { id, method, params = {} } = request;
        try {
            let result = external ? await external(method, params) : undefined;
            if (result === undefined) {
                result = await dispatchMethod(api, method, params);
            }
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
        case 'trashFile':
            return api.trashFile(params);
        case 'restoreFile':
            return api.restoreFile(params);
        case 'restoreAll':
            return api.restoreAll();
        case 'purgeFile':
            return api.purgeFile(params);
        case 'emptyTrash':
            return api.emptyTrash();
        case 'listFiles':
            return api.listFiles(params);
        case 'getSourceDomains':
            return api.getSourceDomains(params);
        // Metadata operations
        case 'updateMetadata':
            return api.updateMetadata(params);
        case 'setFileStarred':
            return api.setFileStarred(params);
        case 'updateFileNotes':
            return api.updateFileNotes(params);
        case 'addFileTags':
            return api.addFileTags(params);
        case 'removeFileTags':
            return api.removeFileTags(params);
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
        // Unified task engine operations
        case 'enqueueTask':
            return api.enqueueTask(params);
        case 'claimTasks':
            return api.claimTasks(params.limit);
        case 'requeueTask':
            return api.requeueTask(params);
        case 'requeueAll':
            return api.requeueAll(params);
        case 'recoverStaleProcessingTasks':
            return api.recoverStaleProcessingTasks();
        case 'getTasksByHash':
            return api.getTasksByHash(params.hash);
        // Classification queue operations (legacy)
        case 'enqueueClassification':
            return api.enqueueClassification(params);
        case 'getQueueStatus':
            return api.getQueueStatus();
        case 'getPendingTasks':
            return api.getPendingTasks(params.limit);
        case 'updateTaskStatus':
            return api.updateTaskStatus(params);
        case 'retryFailedTasks':
            return api.retryFailedTasks(params);
        case 'clearQueue':
            return api.clearQueue(params);
        // Tag vocabulary operations
        case 'applyClassification':
            return api.applyClassification(params);
        case 'getTagVocabulary':
            return api.getTagVocabulary(params);
        case 'resolveTagName':
            return api.resolveTagName(params);
        case 'listTags':
            return api.listTags(params);
        case 'renameTag':
            return api.renameTag(params);
        case 'mergeTags':
            return api.mergeTags(params);
        case 'deleteTag':
            return api.deleteTag(params);
        case 'setTagPinned':
            return api.setTagPinned(params);
        case 'getTagCounts':
            return api.getTagCounts();
        case 'clearIndex':
            return api.clearIndex();
        default:
            throw new Error(`Unknown method: ${method}`);
    }
}
//# sourceMappingURL=dispatcher.js.map