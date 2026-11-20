/**
 * Chunked, event-loop-friendly base64 encoding for Ollama vision requests.
 *
 * Encoding a large image in one call blocks the app's event loop. These
 * helpers encode in three-byte-aligned chunks and yield between them so
 * socket handling and the scheduler stay responsive.
 */
/**
 * Synchronously encode bytes to base64 in multiple-of-3 chunks.
 */
export declare function bytesToBase64Chunked(bytes: Uint8Array): string;
/**
 * Encode bytes to base64 without monopolizing the event loop. Small buffers
 * encode synchronously; large buffers yield between chunks.
 */
export declare function encodeBase64Async(bytes: Uint8Array): Promise<string>;
//# sourceMappingURL=base64.d.ts.map