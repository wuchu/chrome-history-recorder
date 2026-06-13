/**
 * VFS Service - Thumbnail Generation Module
 *
 * Generates thumbnails for images and videos.
 */
/**
 * Thumbnail sizes
 */
export type ThumbnailSize = 'small' | 'medium' | 'large';
/**
 * Thumbnail storage class
 */
export declare class ThumbnailStorage {
    private thumbnailsPath;
    private blobsPath;
    constructor(workspacePath: string);
    /**
     * Get thumbnail file path
     */
    getThumbnailPath(hash: string, size: ThumbnailSize): string;
    /**
     * Check if thumbnail exists
     */
    thumbnailExists(hash: string, size: ThumbnailSize): boolean;
    /**
     * Get thumbnail buffer
     */
    getThumbnail(hash: string, size: ThumbnailSize): Buffer | null;
    /**
     * Generate image thumbnail
     */
    generateImageThumbnail(imagePath: string, hash: string, size: ThumbnailSize): Promise<Buffer>;
    /**
     * Generate video thumbnail (extract first frame)
     */
    generateVideoThumbnail(videoPath: string, hash: string, size: ThumbnailSize): Promise<Buffer>;
    /**
     * Extract first frame from video using ffmpeg
     */
    private extractVideoFrame;
    /**
     * Generate thumbnail for blob
     */
    generateThumbnailForBlob(hash: string, ext: string, mimeType: string, size: ThumbnailSize): Promise<Buffer>;
    /**
     * Clear thumbnail cache
     */
    clearCache(): void;
    /**
     * Get thumbnails path
     */
    getThumbnailsPath(): string;
}
//# sourceMappingURL=thumbnail.d.ts.map