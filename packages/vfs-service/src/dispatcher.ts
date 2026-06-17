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
 * Create message dispatcher
 */
export function createDispatcher(api: VFSAPI): (request: VFSRequest) => Promise<VFSResponse> {
  return async (request: VFSRequest): Promise<VFSResponse> => {
    const { id, method, params = {} } = request;

    try {
      const result = await dispatchMethod(api, method, params);
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

    // Classification queue operations
    case 'enqueueClassification':
      return api.enqueueClassification(params as Parameters<typeof api.enqueueClassification>[0]);

    case 'getQueueStatus':
      return api.getQueueStatus();

    case 'getPendingTasks':
      return api.getPendingTasks(params.limit as number | undefined);

    case 'updateTaskStatus':
      return api.updateTaskStatus(params as Parameters<typeof api.updateTaskStatus>[0]);

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
