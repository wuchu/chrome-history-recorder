/**
 * VFS Service - Thumbnail Generation Module
 *
 * Generates thumbnails for images and videos.
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

// Import ffmpeg-static - it exports string | null
import ffmpegStatic from 'ffmpeg-static';
const ffmpegPath: string | null = ffmpegStatic as unknown as string | null;

/**
 * Thumbnail sizes
 */
export type ThumbnailSize = 'small' | 'medium' | 'large';

const THUMBNAIL_DIMENSIONS: Record<ThumbnailSize, number> = {
  small: 100,
  medium: 200,
  large: 400,
};

/**
 * Thumbnail storage class
 */
export class ThumbnailStorage {
  private thumbnailsPath: string;
  private blobsPath: string;

  constructor(workspacePath: string) {
    this.thumbnailsPath = path.join(workspacePath, 'thumbnails');
    this.blobsPath = path.join(workspacePath, 'blobs');
  }

  /**
   * Get thumbnail file path
   */
  getThumbnailPath(hash: string, size: ThumbnailSize): string {
    const dimension = THUMBNAIL_DIMENSIONS[size];
    return path.join(this.thumbnailsPath, `${hash}-${dimension}.jpg`);
  }

  /**
   * Check if thumbnail exists
   */
  thumbnailExists(hash: string, size: ThumbnailSize): boolean {
    const filePath = this.getThumbnailPath(hash, size);
    return fs.existsSync(filePath);
  }

  /**
   * Get thumbnail buffer
   */
  getThumbnail(hash: string, size: ThumbnailSize): Buffer | null {
    const filePath = this.getThumbnailPath(hash, size);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath);
  }

  /**
   * Generate image thumbnail
   */
  async generateImageThumbnail(
    imagePath: string,
    hash: string,
    size: ThumbnailSize
  ): Promise<Buffer> {
    const dimension = THUMBNAIL_DIMENSIONS[size];
    const thumbnailPath = this.getThumbnailPath(hash, size);

    // Generate thumbnail
    const thumbnailBuffer = await sharp(imagePath)
      .resize(dimension, dimension, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Save to cache
    fs.writeFileSync(thumbnailPath, thumbnailBuffer);

    return thumbnailBuffer;
  }

  /**
   * Generate video thumbnail (extract first frame)
   */
  async generateVideoThumbnail(
    videoPath: string,
    hash: string,
    size: ThumbnailSize
  ): Promise<Buffer> {
    const dimension = THUMBNAIL_DIMENSIONS[size];
    const thumbnailPath = this.getThumbnailPath(hash, size);
    const framePath = path.join(this.thumbnailsPath, `${hash}-frame.jpg`);

    // Extract first frame using ffmpeg
    await this.extractVideoFrame(videoPath, framePath);

    // Resize frame to thumbnail
    const thumbnailBuffer = await sharp(framePath)
      .resize(dimension, dimension, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Save to cache
    fs.writeFileSync(thumbnailPath, thumbnailBuffer);

    // Clean up temporary frame
    if (fs.existsSync(framePath)) {
      fs.unlinkSync(framePath);
    }

    return thumbnailBuffer;
  }

  /**
   * Extract first frame from video using ffmpeg
   */
  private async extractVideoFrame(videoPath: string, outputPath: string): Promise<void> {
    if (!ffmpegPath) {
      throw new Error('ffmpeg not available');
    }

    return new Promise<void>((resolve, reject) => {
      const args = [
        '-i', videoPath,
        '-vf', 'select=eq(n\\,0)',
        '-vframes', '1',
        '-q:v', '2',
        '-y',
        outputPath,
      ];

      const proc: ChildProcess = spawn(ffmpegPath, args);

      proc.on('close', (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });

      proc.on('error', (err: Error) => {
        reject(err);
      });
    });
  }

  /**
   * Generate thumbnail for blob
   */
  async generateThumbnailForBlob(
    hash: string,
    ext: string,
    mimeType: string,
    size: ThumbnailSize
  ): Promise<Buffer> {
    const blobPath = path.join(this.blobsPath, `${hash}.${ext}`);

    if (!fs.existsSync(blobPath)) {
      throw new Error(`Blob not found: ${hash}`);
    }

    // Check if thumbnail already exists
    if (this.thumbnailExists(hash, size)) {
      return this.getThumbnail(hash, size)!;
    }

    // Generate based on type
    if (mimeType.startsWith('image/')) {
      return this.generateImageThumbnail(blobPath, hash, size);
    } else if (mimeType.startsWith('video/')) {
      return this.generateVideoThumbnail(blobPath, hash, size);
    } else {
      throw new Error(`Unsupported MIME type for thumbnail: ${mimeType}`);
    }
  }

  /**
   * Clear thumbnail cache
   */
  clearCache(): void {
    const files = fs.readdirSync(this.thumbnailsPath);
    for (const file of files) {
      const filePath = path.join(this.thumbnailsPath, file);
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Get thumbnails path
   */
  getThumbnailsPath(): string {
    return this.thumbnailsPath;
  }
}