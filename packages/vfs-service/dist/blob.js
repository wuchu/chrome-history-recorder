"use strict";
/**
 * VFS Service - Blob Storage Module
 *
 * Manages physical blob storage with content-addressable naming.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlobStorage = void 0;
exports.calculateHash = calculateHash;
exports.getExtensionFromMimeType = getExtensionFromMimeType;
exports.getMimeTypeFromExtension = getMimeTypeFromExtension;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * MIME type to extension mapping
 */
const MIME_TO_EXT = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/svg+xml': 'svg',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/ogg': 'ogv',
    'video/x-matroska': 'mkv',
};
/**
 * Extension to MIME type mapping
 */
const EXT_TO_MIME = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'ogv': 'video/ogg',
    'mkv': 'video/x-matroska',
};
/**
 * Calculate SHA-256 hash and truncate to 16 characters
 */
function calculateHash(buffer) {
    const hash = crypto_1.default.createHash('sha256').update(buffer).digest('hex');
    return hash.substring(0, 16);
}
/**
 * Get extension from MIME type
 */
function getExtensionFromMimeType(mimeType) {
    return MIME_TO_EXT[mimeType] || 'bin';
}
/**
 * Get MIME type from extension
 */
function getMimeTypeFromExtension(ext) {
    return EXT_TO_MIME[ext.toLowerCase()] || 'application/octet-stream';
}
/**
 * Blob storage class
 */
class BlobStorage {
    blobsPath;
    constructor(workspacePath) {
        this.blobsPath = path_1.default.join(workspacePath, 'blobs');
    }
    /**
     * Get blob file path
     */
    getBlobPath(hash, ext) {
        return path_1.default.join(this.blobsPath, `${hash}.${ext}`);
    }
    /**
     * Save blob to storage
     * Returns true if file was saved, false if duplicate
     */
    saveBlob(buffer, hash, mimeType) {
        const ext = getExtensionFromMimeType(mimeType);
        const filePath = this.getBlobPath(hash, ext);
        // Check if file already exists (duplicate)
        if (fs_1.default.existsSync(filePath)) {
            return { saved: false, ext, size: buffer.length };
        }
        // Write file
        fs_1.default.writeFileSync(filePath, buffer, { mode: 0o644 });
        return { saved: true, ext, size: buffer.length };
    }
    /**
     * Read blob from storage
     */
    readBlob(hash, ext) {
        const filePath = this.getBlobPath(hash, ext);
        if (!fs_1.default.existsSync(filePath)) {
            return null;
        }
        return fs_1.default.readFileSync(filePath);
    }
    /**
     * Check if blob exists
     */
    blobExists(hash, ext) {
        const filePath = this.getBlobPath(hash, ext);
        return fs_1.default.existsSync(filePath);
    }
    /**
     * Delete blob from storage
     */
    deleteBlob(hash, ext) {
        const filePath = this.getBlobPath(hash, ext);
        if (!fs_1.default.existsSync(filePath)) {
            return false;
        }
        fs_1.default.unlinkSync(filePath);
        return true;
    }
    /**
     * Get blob size
     */
    getBlobSize(hash, ext) {
        const filePath = this.getBlobPath(hash, ext);
        if (!fs_1.default.existsSync(filePath)) {
            return null;
        }
        const stat = fs_1.default.statSync(filePath);
        return stat.size;
    }
    /**
     * List all blobs
     */
    listBlobs() {
        const files = fs_1.default.readdirSync(this.blobsPath);
        const blobs = [];
        for (const file of files) {
            const filePath = path_1.default.join(this.blobsPath, file);
            const stat = fs_1.default.statSync(filePath);
            const parts = file.split('.');
            const hash = parts[0];
            const ext = parts.slice(1).join('.') || 'bin';
            blobs.push({
                hash,
                ext,
                path: filePath,
                size: stat.size,
            });
        }
        return blobs;
    }
    /**
     * Get blobs path
     */
    getBlobsPath() {
        return this.blobsPath;
    }
}
exports.BlobStorage = BlobStorage;
//# sourceMappingURL=blob.js.map