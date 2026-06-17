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
export declare function createSuccessResponse(data: unknown, id?: number): VFSResponse;
/**
 * Create error response
 */
export declare function createErrorResponse(error: string, id?: number): VFSResponse;
/**
 * Create message dispatcher
 */
export declare function createDispatcher(api: VFSAPI): (request: VFSRequest) => Promise<VFSResponse>;
//# sourceMappingURL=dispatcher.d.ts.map