"use strict";
/**
 * VFS Service - Thumbnail Generation Module
 *
 * Generates thumbnails for images and videos.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThumbnailStorage = void 0;
const sharp_1 = __importDefault(require("sharp"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
// Import ffmpeg-static - it exports string | null
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const ffmpegPath = ffmpeg_static_1.default;
const THUMBNAIL_DIMENSIONS = {
    small: 100,
    medium: 200,
    large: 400,
};
/**
 * Thumbnail storage class
 */
class ThumbnailStorage {
    thumbnailsPath;
    blobsPath;
    constructor(workspacePath) {
        this.thumbnailsPath = path_1.default.join(workspacePath, 'thumbnails');
        this.blobsPath = path_1.default.join(workspacePath, 'blobs');
    }
    /**
     * Get thumbnail file path
     */
    getThumbnailPath(hash, size) {
        const dimension = THUMBNAIL_DIMENSIONS[size];
        return path_1.default.join(this.thumbnailsPath, `${hash}-${dimension}.jpg`);
    }
    /**
     * Check if thumbnail exists
     */
    thumbnailExists(hash, size) {
        const filePath = this.getThumbnailPath(hash, size);
        return fs_1.default.existsSync(filePath);
    }
    /**
     * Get thumbnail buffer
     */
    getThumbnail(hash, size) {
        const filePath = this.getThumbnailPath(hash, size);
        if (!fs_1.default.existsSync(filePath)) {
            return null;
        }
        return fs_1.default.readFileSync(filePath);
    }
    /**
     * Generate image thumbnail
     */
    async generateImageThumbnail(imagePath, hash, size) {
        const dimension = THUMBNAIL_DIMENSIONS[size];
        const thumbnailPath = this.getThumbnailPath(hash, size);
        // Generate thumbnail
        const thumbnailBuffer = await (0, sharp_1.default)(imagePath)
            .resize(dimension, dimension, {
            fit: 'inside',
            withoutEnlargement: true,
        })
            .jpeg({ quality: 80 })
            .toBuffer();
        // Save to cache
        fs_1.default.writeFileSync(thumbnailPath, thumbnailBuffer);
        return thumbnailBuffer;
    }
    /**
     * Generate video thumbnail (extract first frame)
     */
    async generateVideoThumbnail(videoPath, hash, size) {
        const dimension = THUMBNAIL_DIMENSIONS[size];
        const thumbnailPath = this.getThumbnailPath(hash, size);
        const framePath = path_1.default.join(this.thumbnailsPath, `${hash}-frame.jpg`);
        // Extract first frame using ffmpeg
        await this.extractVideoFrame(videoPath, framePath);
        // Resize frame to thumbnail
        const thumbnailBuffer = await (0, sharp_1.default)(framePath)
            .resize(dimension, dimension, {
            fit: 'inside',
            withoutEnlargement: true,
        })
            .jpeg({ quality: 80 })
            .toBuffer();
        // Save to cache
        fs_1.default.writeFileSync(thumbnailPath, thumbnailBuffer);
        // Clean up temporary frame
        if (fs_1.default.existsSync(framePath)) {
            fs_1.default.unlinkSync(framePath);
        }
        return thumbnailBuffer;
    }
    /**
     * Extract first frame from video using ffmpeg
     */
    async extractVideoFrame(videoPath, outputPath) {
        if (!ffmpegPath) {
            throw new Error('ffmpeg not available');
        }
        return new Promise((resolve, reject) => {
            const args = [
                '-i', videoPath,
                '-vf', 'select=eq(n\\,0)',
                '-vframes', '1',
                '-q:v', '2',
                '-y',
                outputPath,
            ];
            const proc = (0, child_process_1.spawn)(ffmpegPath, args);
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`ffmpeg exited with code ${code}`));
                }
            });
            proc.on('error', (err) => {
                reject(err);
            });
        });
    }
    /**
     * Generate thumbnail for blob
     */
    async generateThumbnailForBlob(hash, ext, mimeType, size) {
        const blobPath = path_1.default.join(this.blobsPath, `${hash}.${ext}`);
        if (!fs_1.default.existsSync(blobPath)) {
            throw new Error(`Blob not found: ${hash}`);
        }
        // Check if thumbnail already exists
        if (this.thumbnailExists(hash, size)) {
            return this.getThumbnail(hash, size);
        }
        // Generate based on type
        if (mimeType.startsWith('image/')) {
            return this.generateImageThumbnail(blobPath, hash, size);
        }
        else if (mimeType.startsWith('video/')) {
            return this.generateVideoThumbnail(blobPath, hash, size);
        }
        else {
            throw new Error(`Unsupported MIME type for thumbnail: ${mimeType}`);
        }
    }
    /**
     * Clear thumbnail cache
     */
    clearCache() {
        const files = fs_1.default.readdirSync(this.thumbnailsPath);
        for (const file of files) {
            const filePath = path_1.default.join(this.thumbnailsPath, file);
            fs_1.default.unlinkSync(filePath);
        }
    }
    /**
     * Get thumbnails path
     */
    getThumbnailsPath() {
        return this.thumbnailsPath;
    }
}
exports.ThumbnailStorage = ThumbnailStorage;
//# sourceMappingURL=thumbnail.js.map