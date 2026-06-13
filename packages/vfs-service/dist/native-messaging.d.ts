/**
 * VFS Service - Native Messaging Protocol Module
 *
 * Handles Chrome Native Messaging stdin/stdout JSON protocol.
 */
/**
 * Native message format:
 * - First 4 bytes: message length (uint32, native endian)
 * - Remaining bytes: JSON payload
 */
/**
 * Read a message from stdin
 */
export declare function readMessage(): Promise<unknown>;
/**
 * Write a message to stdout
 */
export declare function writeMessage(message: unknown): void;
/**
 * Native Messaging request type
 */
export interface NativeRequest {
    id?: number;
    method: string;
    params?: Record<string, unknown>;
}
/**
 * Native Messaging response type
 */
export interface NativeResponse {
    id?: number;
    success: boolean;
    data?: unknown;
    error?: string;
}
/**
 * Create success response
 */
export declare function createSuccessResponse(data: unknown, id?: number): NativeResponse;
/**
 * Create error response
 */
export declare function createErrorResponse(error: string, id?: number): NativeResponse;
//# sourceMappingURL=native-messaging.d.ts.map