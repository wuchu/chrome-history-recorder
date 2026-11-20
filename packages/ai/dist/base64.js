"use strict";
/**
 * Chunked, event-loop-friendly base64 encoding for Ollama vision requests.
 *
 * Encoding a large image in one call blocks the app's event loop. These
 * helpers encode in three-byte-aligned chunks and yield between them so
 * socket handling and the scheduler stay responsive.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bytesToBase64Chunked = bytesToBase64Chunked;
exports.encodeBase64Async = encodeBase64Async;
/** Must be a multiple of 3 so per-chunk base64 output concatenates correctly. */
const ENCODE_CHUNK = 0x6000; // 24576 = 3 * 8192
/** Buffers below this size are small enough to encode in one pass. */
const YIELD_THRESHOLD = 256 * 1024; // 256 KiB
/** Yield a macrotask so queued I/O and timers can run. */
function yieldToEventLoop() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
/**
 * Synchronously encode bytes to base64 in multiple-of-3 chunks.
 */
function bytesToBase64Chunked(bytes) {
    const parts = [];
    for (let i = 0; i < bytes.length; i += ENCODE_CHUNK) {
        parts.push(Buffer.from(bytes.subarray(i, i + ENCODE_CHUNK)).toString('base64'));
    }
    return parts.join('');
}
/**
 * Encode bytes to base64 without monopolizing the event loop. Small buffers
 * encode synchronously; large buffers yield between chunks.
 */
async function encodeBase64Async(bytes) {
    if (bytes.length <= YIELD_THRESHOLD) {
        return bytesToBase64Chunked(bytes);
    }
    const parts = [];
    for (let i = 0; i < bytes.length; i += ENCODE_CHUNK) {
        parts.push(Buffer.from(bytes.subarray(i, i + ENCODE_CHUNK)).toString('base64'));
        if (i + ENCODE_CHUNK < bytes.length) {
            await yieldToEventLoop();
        }
    }
    return parts.join('');
}
//# sourceMappingURL=base64.js.map