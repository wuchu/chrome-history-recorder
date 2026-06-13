/**
 * VFS Service - Blob Storage Module
 *
 * Manages physical blob storage with content-addressable naming.
 */
/**
 * Calculate SHA-256 hash and truncate to 16 characters
 */
export declare function calculateHash(buffer: Buffer): string;
/**
 * Get extension from MIME type
 */
export declare function getExtensionFromMimeType(mimeType: string): string;
/**
 * Get MIME type from extension
 */
export declare function getMimeTypeFromExtension(ext: string): string;
/**
 * Blob storage class
 */
export declare class BlobStorage {
    private blobsPath;
    constructor(workspacePath: string);
    /**
     * Get blob file path
     */
    getBlobPath(hash: string, ext: string): string;
    /**
     * Save blob to storage
     * Returns true if file was saved, false if duplicate
     */
    saveBlob(buffer: Buffer, hash: string, mimeType: string): {
        saved: boolean;
        ext: string;
        size: number;
    };
    /**
     * Read blob from storage
     */
    readBlob(hash: string, ext: string): Buffer | null;
    /**
     * Check if blob exists
     */
    blobExists(hash: string, ext: string): boolean;
    /**
     * Delete blob from storage
     */
    deleteBlob(hash: string, ext: string): boolean;
    /**
     * Get blob size
     */
    getBlobSize(hash: string, ext: string): number | null;
    /**
     * List all blobs
     */
    listBlobs(): Array<{
        hash: string;
        ext: string;
        path: string;
        size: number;
    }>;
    /**
     * Get blobs path
     */
    getBlobsPath(): string;
}
//# sourceMappingURL=blob.d.ts.map