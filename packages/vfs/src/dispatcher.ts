/**
 * VFS Service - Message Dispatcher Module
 *
 * Routes WebSocket requests to appropriate API handlers.
 */

import { VFSAPI } from './api';

/**
 * Request type
 */
export interface VFSRequest {
  id?: number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * Response type
 */
export interface VFSResponse {
  id?: number;
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Create success response
 */
export function createSuccessResponse(data: unknown, id?: number): VFSResponse {
  return {
    id,
    success: true,
    data,
  };
}

/**
 * Create error response
 */
export function createErrorResponse(error: string, id?: number): VFSResponse {
  return {
    id,
    success: false,
    error,
  };
}

/**
 * Handler for methods owned by the app rather than the storage layer.
 * Returning `undefined` falls through to the VFS method table.
 */
export type ExternalHandler = (
  method: string,
  params: Record<string, unknown>
) => Promise<unknown> | unknown;

/**
 * Create message dispatcher
 */
export function createDispatcher(
  api: VFSAPI,
  external?: ExternalHandler
): (request: VFSRequest) => Promise<VFSResponse> {
  return async (request: VFSRequest): Promise<VFSResponse> => {
    const { id, method, params = {} } = request;

    try {
      let result = external ? await external(method, params) : undefined;
      if (result === undefined) {
        result = await dispatchMethod(api, method, params);
      }
      return createSuccessResponse(result, id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResponse(message, id);
    }
  };
}

/**
 * Dispatch method to API handler
 */
async function dispatchMethod(
  api: VFSAPI,
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (method) {
    // File operations
    case 'saveFile':
      return api.saveFile(params as Parameters<typeof api.saveFile>[0]);

    case 'getFile':
      return api.getFile(params.hash as string);

    case 'deleteFile':
      return api.deleteFile(params as Parameters<typeof api.deleteFile>[0]);

    case 'listFiles':
      return api.listFiles(params as Parameters<typeof api.listFiles>[0]);

    // Metadata operations
    case 'updateMetadata':
      return api.updateMetadata(params as Parameters<typeof api.updateMetadata>[0]);

    case 'getMetadata':
      return api.getMetadata(params.hash as string);

    // Thumbnail operations
    case 'getThumbnail':
      return api.getThumbnail(params as Parameters<typeof api.getThumbnail>[0]);

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
      return api.enqueueTask(params as unknown as Parameters<typeof api.enqueueTask>[0]);

    case 'claimTasks':
      return api.claimTasks(params.limit as number | undefined);

    case 'requeueTask':
      return api.requeueTask(params as Parameters<typeof api.requeueTask>[0]);

    case 'requeueAll':
      return api.requeueAll(params as Parameters<typeof api.requeueAll>[0]);

    case 'recoverStaleProcessingTasks':
      return api.recoverStaleProcessingTasks();

    case 'getTasksByHash':
      return api.getTasksByHash(params.hash as string);

    // Classification queue operations (legacy)
    case 'enqueueClassification':
      return api.enqueueClassification(params as Parameters<typeof api.enqueueClassification>[0]);

    case 'getQueueStatus':
      return api.getQueueStatus();

    case 'getPendingTasks':
      return api.getPendingTasks(params.limit as number | undefined);

    case 'updateTaskStatus':
      return api.updateTaskStatus(params as Parameters<typeof api.updateTaskStatus>[0]);

    case 'retryFailedTasks':
      return api.retryFailedTasks(params as Parameters<typeof api.retryFailedTasks>[0]);

    case 'clearQueue':
      return api.clearQueue(params as Parameters<typeof api.clearQueue>[0]);

    // Tag vocabulary operations
    case 'applyClassification':
      return api.applyClassification(
        params as unknown as Parameters<typeof api.applyClassification>[0]
      );

    case 'getTagVocabulary':
      return api.getTagVocabulary(params as Parameters<typeof api.getTagVocabulary>[0]);

    case 'resolveTagName':
      return api.resolveTagName(params as Parameters<typeof api.resolveTagName>[0]);

    case 'listTags':
      return api.listTags(params as Parameters<typeof api.listTags>[0]);

    case 'renameTag':
      return api.renameTag(params as Parameters<typeof api.renameTag>[0]);

    case 'mergeTags':
      return api.mergeTags(params as Parameters<typeof api.mergeTags>[0]);

    case 'deleteTag':
      return api.deleteTag(params as Parameters<typeof api.deleteTag>[0]);

    case 'setTagPinned':
      return api.setTagPinned(params as Parameters<typeof api.setTagPinned>[0]);

    case 'getTagCounts':
      return api.getTagCounts();

    case 'clearIndex':
      return api.clearIndex();

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}
