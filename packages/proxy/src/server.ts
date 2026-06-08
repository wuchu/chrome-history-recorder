import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger, requestLoggerMiddleware, isDebugEnabled } from './logger.js';
import debugRouter, { updateRestartStatus, getDebugStatus } from './routes/debug.js';

const app: Application = express();

// Configuration
const PORT: number = parseInt(process.env.PORT || '3777', 10);
const DEFAULT_STORAGE_PATH: string = path.join(os.homedir(), 'Downloads', 'chrome-history');
const MAX_BODY_SIZE = '100mb';
const GRACEFUL_SHUTDOWN_TIMEOUT = 5000; // 5 seconds

// Current storage path (can be configured)
let currentStoragePath: string = DEFAULT_STORAGE_PATH;

// Server reference for graceful shutdown
let server: ReturnType<Application['listen']> | null = null;
let isShuttingDown = false;

// Middleware
app.use(
  cors({
    origin: ['chrome-extension://*', 'http://localhost:*', 'http://127.0.0.1:*'],
  })
);
app.use(express.json({ limit: MAX_BODY_SIZE }));

// Request logging middleware (only in debug mode)
if (isDebugEnabled()) {
  app.use(requestLoggerMiddleware);
}

// Utility functions

/**
 * Generate SHA-256 hash and truncate to 16 characters
 */
function generateHash(buffer: Buffer): string {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  return hash.substring(0, 16);
}

/**
 * Get extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
    'image/svg+xml': '.svg',
    'image/x-icon': '.ico',
    'image/vnd.microsoft.icon': '.ico',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi',
    'video/ogg': '.ogv',
    'video/x-matroska': '.mkv',
  };
  return mimeToExt[mimeType] || '.bin';
}

/**
 * Generate filename using content hash
 */
function generateFilename(hash: string, mimeType: string): string {
  const ext = getExtensionFromMimeType(mimeType);
  return `${hash}${ext}`;
}

/**
 * Get date-based directory path (YYYY-MM-DD)
 */
function getDateDirectory(): string {
  const today = new Date().toISOString().split('T')[0];
  return path.join(currentStoragePath, today);
}

/**
 * Ensure directory exists
 */
function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
    logger.debug(`Created directory: ${dirPath}`);
  }
}

/**
 * Expand ~ to home directory
 */
function expandPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * Validate path
 */
function validatePath(filePath: string): boolean {
  if (!filePath || filePath.trim() === '') {
    return false;
  }
  // eslint-disable-next-line no-control-regex
  const illegalChars = /[<>:"|?*\x00-\x1f]/;
  if (illegalChars.test(filePath)) {
    return false;
  }
  if (filePath.includes('..') || filePath.includes('../') || filePath.includes('..\\')) {
    return false;
  }
  if (filePath.length > 255) {
    return false;
  }
  return true;
}

/**
 * Parse base64 data
 */
function parseBase64Data(data: string): string {
  if (data.includes(',')) {
    const parts = data.split(',');
    return parts[1];
  }
  return data;
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Already shutting down, ignoring signal');
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown`);

  updateRestartStatus(signal === 'SIGTERM' ? 'file-change' : 'manual');

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // Wait for existing connections to finish
  const timeout = setTimeout(() => {
    logger.warn('Graceful shutdown timeout, forcing exit');
    process.exit(1);
  }, GRACEFUL_SHUTDOWN_TIMEOUT);

  // Cleanup
  try {
    // Any cleanup tasks here
    logger.info('Cleanup completed');
    clearTimeout(timeout);
    process.exit(0);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Cleanup failed', { error: err.message });
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Initialize storage directory
ensureDirectory(currentStoragePath);

// API Endpoints

/**
 * POST /save-image - Save an image
 */
app.post('/save-image', (req: Request, res: Response) => {
  try {
    const { url, mimeType, data } = req.body;

    if (!url || !mimeType || !data) {
      logger.warn('Missing required fields in save-image request');
      return res.status(400).json({ error: 'Missing required fields: url, mimeType, data' });
    }

    const base64Data = parseBase64Data(data);
    const buffer = Buffer.from(base64Data, 'base64');
    const hash = generateHash(buffer);
    const filename = generateFilename(hash, mimeType);
    const dateDir = getDateDirectory();
    ensureDirectory(dateDir);
    const filePath = path.join(dateDir, filename);

    if (fs.existsSync(filePath)) {
      logger.debug(`Duplicate image detected: ${hash}`);
      return res.json({
        success: true,
        hash: hash,
        filePath: filePath,
        filename: filename,
        duplicate: true,
      });
    }

    fs.writeFileSync(filePath, buffer);
    logger.info(`Image saved: ${filename}`, { hash, size: buffer.length, mimeType });

    res.json({
      success: true,
      hash: hash,
      filePath: filePath,
      filename: filename,
      duplicate: false,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error saving image', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /images - List all images
 */
app.get('/images', (req: Request, res: Response) => {
  try {
    const date = req.query.date as string | undefined;
    let searchPath = currentStoragePath;

    if (date) {
      searchPath = path.join(currentStoragePath, date);
      if (!fs.existsSync(searchPath)) {
        return res.json([]);
      }
    }

    const images: Array<{
      hash: string;
      filename: string;
      filePath: string;
      size: number;
      date: string;
      timestamp: Date;
    }> = [];

    const walkDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          walkDir(filePath);
        } else if (stat.isFile()) {
          const hash = path.parse(file).name;
          const fileDate = path.basename(dir);
          images.push({
            hash: hash,
            filename: file,
            filePath: filePath,
            size: stat.size,
            date: fileDate,
            timestamp: stat.birthtime,
          });
        }
      }
    };

    walkDir(searchPath);
    logger.debug(`Listed ${images.length} images`);
    res.json(images);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error listing images', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /images/:hash - Retrieve specific image
 */
app.get('/images/:hash', (req: Request, res: Response) => {
  try {
    const hash = req.params.hash;
    const walkDir = (dir: string): string | null => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          const result = walkDir(filePath);
          if (result) return result;
        } else if (stat.isFile() && file.startsWith(hash)) {
          return filePath;
        }
      }
      return null;
    };

    const filePath = walkDir(currentStoragePath);
    if (!filePath) {
      logger.warn(`Image not found: ${hash}`);
      return res.status(404).json({ error: 'Image not found' });
    }

    res.sendFile(filePath);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error retrieving image', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /images/:hash - Delete specific image
 */
app.delete('/images/:hash', (req: Request, res: Response) => {
  try {
    const hash = req.params.hash;
    const walkDir = (dir: string): string | null => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          const result = walkDir(filePath);
          if (result) return result;
        } else if (stat.isFile() && file.startsWith(hash)) {
          return filePath;
        }
      }
      return null;
    };

    const filePath = walkDir(currentStoragePath);
    if (!filePath) {
      logger.warn(`Image not found for deletion: ${hash}`);
      return res.status(404).json({ error: 'Image not found' });
    }

    fs.unlinkSync(filePath);
    logger.info(`Image deleted: ${hash}`);
    res.json({ success: true, message: 'Image deleted' });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error deleting image', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /health - Health check (with debug info in debug mode)
 */
app.get('/health', (req: Request, res: Response) => {
  try {
    const getMediaStats = () => {
      const stats = {
        totalImages: 0,
        totalVideos: 0,
        totalImageSize: 0,
        totalVideoSize: 0,
      };
      const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.ogv', '.mkv'];
      const walkDir = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            walkDir(filePath);
          } else if (stat.isFile()) {
            const ext = path.extname(file).toLowerCase();
            if (videoExtensions.includes(ext)) {
              stats.totalVideos++;
              stats.totalVideoSize += stat.size;
            } else {
              stats.totalImages++;
              stats.totalImageSize += stat.size;
            }
          }
        }
      };
      walkDir(currentStoragePath);
      return stats;
    };

    const mediaStats = getMediaStats();

    const response: Record<string, unknown> = {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      storagePath: currentStoragePath,
      totalImages: mediaStats.totalImages,
      totalVideos: mediaStats.totalVideos,
      totalImageSize: mediaStats.totalImageSize,
      totalVideoSize: mediaStats.totalVideoSize,
      totalSize: mediaStats.totalImageSize + mediaStats.totalVideoSize,
    };

    // Add debug info in debug mode
    if (isDebugEnabled()) {
      response.debugMode = true;
      response.restartCount = getDebugStatus().restartCount;
      response.lastRestart = getDebugStatus().lastRestart;
    }

    res.json(response);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Health check failed', { error: err.message });
    res.status(500).json({ status: 'error', error: err.message });
  }
});

/**
 * POST /config/storage-path - Update storage path
 */
app.post('/config/storage-path', (req: Request, res: Response) => {
  try {
    const { path: newPath } = req.body;

    if (!newPath) {
      logger.warn('Storage path update failed: path required');
      return res.status(400).json({ error: 'Path is required' });
    }

    const expandedPath = expandPath(newPath);

    if (!validatePath(expandedPath)) {
      logger.warn('Storage path update failed: invalid path', { path: newPath });
      return res.status(400).json({ error: 'Invalid path format' });
    }

    currentStoragePath = expandedPath;
    ensureDirectory(currentStoragePath);
    logger.info(`Storage path updated: ${currentStoragePath}`);

    res.json({
      success: true,
      storagePath: currentStoragePath,
      message: 'Storage path updated',
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error updating storage path', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /config/storage-path - Get current storage path
 */
app.get('/config/storage-path', (req: Request, res: Response) => {
  res.json({
    storagePath: currentStoragePath,
  });
});

// Register debug routes (only in debug mode)
if (isDebugEnabled()) {
  app.use('/debug', debugRouter);
  logger.info('Debug endpoints registered at /debug/*');
}

// Start server
server = app.listen(PORT, () => {
  logger.info(`Media Recorder Proxy Service running on port ${PORT}`);
  logger.info(`Storage directory: ${currentStoragePath}`);
  logger.info(`Max upload size: ${MAX_BODY_SIZE}`);
  logger.info(`Debug mode: ${isDebugEnabled() ? 'enabled' : 'disabled'}`);
});
