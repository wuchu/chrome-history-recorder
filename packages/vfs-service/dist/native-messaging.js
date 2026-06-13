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
export async function readMessage() {
    // Read 4-byte length header
    const lengthBuffer = await readBytes(4);
    const length = new Uint32Array(lengthBuffer.buffer)[0];
    // Read message payload
    const payloadBuffer = await readBytes(length);
    const payload = payloadBuffer.toString('utf8');
    return JSON.parse(payload);
}
/**
 * Write a message to stdout
 */
export function writeMessage(message) {
    const payload = JSON.stringify(message);
    const payloadBuffer = Buffer.from(payload, 'utf8');
    const length = payloadBuffer.length;
    // Write 4-byte length header
    const lengthBuffer = Buffer.alloc(4);
    new Uint32Array(lengthBuffer.buffer)[0] = length;
    process.stdout.write(lengthBuffer);
    process.stdout.write(payloadBuffer);
}
/**
 * Read bytes from stdin
 */
async function readBytes(count) {
    return new Promise((resolve, reject) => {
        const buffer = Buffer.alloc(count);
        let bytesRead = 0;
        const onData = (chunk) => {
            const remaining = count - bytesRead;
            const copyCount = Math.min(chunk.length, remaining);
            chunk.copy(buffer, bytesRead, 0, copyCount);
            bytesRead += copyCount;
            if (bytesRead === count) {
                process.stdin.removeListener('data', onData);
                resolve(buffer);
            }
            else if (chunk.length > copyCount) {
                // There's more data in this chunk than we needed
                // This shouldn't happen in normal Native Messaging flow
                reject(new Error('Unexpected extra data in chunk'));
            }
        };
        process.stdin.on('data', onData);
        // Handle stdin close (Native Host disconnected)
        process.stdin.on('end', () => {
            process.stdin.removeListener('data', onData);
            reject(new Error('stdin closed'));
        });
    });
}
/**
 * Create success response
 */
export function createSuccessResponse(data, id) {
    return {
        id,
        success: true,
        data,
    };
}
/**
 * Create error response
 */
export function createErrorResponse(error, id) {
    return {
        id,
        success: false,
        error,
    };
}
//# sourceMappingURL=native-messaging.js.map