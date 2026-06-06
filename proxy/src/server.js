import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const app = express();

// Configuration
const PORT = process.env.PORT || 3777;
const DEFAULT_STORAGE_PATH = path.join(os.homedir(), 'Downloads', 'chrome-history');
const MAX_BODY_SIZE = '50mb';

// Current storage path (can be configured)
let currentStoragePath = DEFAULT_STORAGE_PATH;

// Middleware
app.use(cors({
  origin: ['chrome-extension://*', 'http://localhost:*', 'http://127.0.0.1:*']
}));
app.use(express.json({ limit: MAX_BODY_SIZE }));

// Utility functions

/**
 * Generate SHA-256 hash and truncate to 16 characters
 */
function generateHash(buffer) {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  return hash.substring(0, 16);
}

/**
 * Get extension from MIME type
 */
function getExtensionFromMimeType(mimeType) {
  const mimeToExt = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
    'image/svg+xml': '.svg',
    'image/x-icon': '.ico',
    'image/vnd.microsoft.icon': '.ico'
  };
  return mimeToExt[mimeType] || '.bin';
}

/**
 * Get extension from URL
 */
function getExtensionFromUrl(url) {
  try {
    const urlPath = new URL(url).pathname;
    const ext = path.extname(urlPath);
    return ext || '.bin';
  } catch {
    return '.bin';
  }
}

/**
 * Generate filename using content hash
 * Format: {hash}{ext}
 * This enables automatic deduplication - same content = same filename
 */
function generateFilename(hash, mimeType) {
  const ext = getExtensionFromMimeType(mimeType);
  return `${hash}${ext}`;
}

/**
 * Get date-based directory path (YYYY-MM-DD)
 */
function getDateDirectory() {
  const today = new Date().toISOString().split('T')[0];
  return path.join(currentStoragePath, today);
}

/**
 * Ensure directory exists
 */
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
  }
}

/**
 * Expand ~ to home directory
 */
function expandPath(filePath) {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * Validate path (check for illegal characters)
 */
function validatePath(filePath) {
  if (!filePath || filePath.trim() === '') {
    return false;
  }

  // Check for illegal characters
  const illegalChars = /[<>:"|?*\x00-\x1f]/;
  if (illegalChars.test(filePath)) {
    return false;
  }

  // Check for path traversal
  if (filePath.includes('..') || filePath.includes('../') || filePath.includes('..\\')) {
    return false;
  }

  // Check length
  if (filePath.length > 255) {
    return false;
  }

  return true;
}

/**
 * Parse base64 data (handle both data URL and pure base64)
 */
function parseBase64Data(data) {
  if (data.includes(',')) {
    // Data URL format: data:image/jpeg;base64,<data>
    const parts = data.split(',');
    return parts[1];
  }
  // Pure base64
  return data;
}

// Initialize storage directory
ensureDirectory(currentStoragePath);

// API Endpoints

/**
 * POST /save-image - Save an image
 */
app.post('/save-image', (req, res) => {
  try {
    const { url, mimeType, data } = req.body;

    if (!url || !mimeType || !data) {
      return res.status(400).json({ error: 'Missing required fields: url, mimeType, data' });
    }

    // Parse and decode base64 data
    const base64Data = parseBase64Data(data);
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate hash from content
    const hash = generateHash(buffer);

    // Generate filename using hash
    const filename = generateFilename(hash, mimeType);

    // Create date directory
    const dateDir = getDateDirectory();
    ensureDirectory(dateDir);

    // Full file path
    const filePath = path.join(dateDir, filename);

    // Check if file already exists (deduplication by content hash)
    if (fs.existsSync(filePath)) {
      console.log(`Duplicate image detected: ${hash}`);
      return res.json({
        success: true,
        hash: hash,
        filePath: filePath,
        filename: filename,
        duplicate: true
      });
    }

    // Write file
    fs.writeFileSync(filePath, buffer);

    res.json({
      success: true,
      hash: hash,
      filePath: filePath,
      filename: filename,
      duplicate: false
    });
  } catch (error) {
    console.error('Error saving image:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /images - List all images
 */
app.get('/images', (req, res) => {
  try {
    const date = req.query.date;
    let searchPath = currentStoragePath;

    if (date) {
      // Filter by specific date
      searchPath = path.join(currentStoragePath, date);
      if (!fs.existsSync(searchPath)) {
        return res.json([]);
      }
    }

    const images = [];

    // Walk through directories
    const walkDir = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          walkDir(filePath);
        } else if (stat.isFile()) {
          // Extract hash from filename (format: {hash}.ext)
          const hash = path.parse(file).name;
          const fileDate = path.basename(dir);

          images.push({
            hash: hash,
            filename: file,
            filePath: filePath,
            size: stat.size,
            date: fileDate,
            timestamp: stat.birthtime
          });
        }
      }
    };

    walkDir(searchPath);

    res.json(images);
  } catch (error) {
    console.error('Error listing images:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /images/:hash - Retrieve specific image
 */
app.get('/images/:hash', (req, res) => {
  try {
    const hash = req.params.hash;

    // Search for file with matching hash
    const walkDir = (dir) => {
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
      return res.status(404).json({ error: 'Image not found' });
    }

    // Send file
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error retrieving image:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /images/:hash - Delete specific image
 */
app.delete('/images/:hash', (req, res) => {
  try {
    const hash = req.params.hash;

    // Search for file with matching hash
    const walkDir = (dir) => {
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
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete file
    fs.unlinkSync(filePath);

    res.json({ success: true, message: 'Image deleted' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /health - Health check
 */
app.get('/health', (req, res) => {
  try {
    // Get basic stats
    const totalImages = (() => {
      let count = 0;
      const walkDir = (dir) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            walkDir(filePath);
          } else if (stat.isFile()) {
            count++;
          }
        }
      };
      if (fs.existsSync(currentStoragePath)) {
        walkDir(currentStoragePath);
      }
      return count;
    })();

    const totalSize = (() => {
      let size = 0;
      const walkDir = (dir) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            walkDir(filePath);
          } else if (stat.isFile()) {
            size += stat.size;
          }
        }
      };
      if (fs.existsSync(currentStoragePath)) {
        walkDir(currentStoragePath);
      }
      return size;
    })();

    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      storagePath: currentStoragePath,
      totalImages: totalImages,
      totalSize: totalSize
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

/**
 * POST /config/storage-path - Update storage path
 */
app.post('/config/storage-path', (req, res) => {
  try {
    const { path: newPath } = req.body;

    if (!newPath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    // Expand ~ to home directory
    const expandedPath = expandPath(newPath);

    // Validate path
    if (!validatePath(expandedPath)) {
      return res.status(400).json({ error: 'Invalid path format' });
    }

    // Update storage path
    currentStoragePath = expandedPath;

    // Ensure directory exists
    ensureDirectory(currentStoragePath);

    res.json({
      success: true,
      storagePath: currentStoragePath,
      message: 'Storage path updated'
    });
  } catch (error) {
    console.error('Error updating storage path:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /config/storage-path - Get current storage path
 */
app.get('/config/storage-path', (req, res) => {
  res.json({
    storagePath: currentStoragePath
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Image Recorder Proxy Service running on port ${PORT}`);
  console.log(`Storage directory: ${currentStoragePath}`);
});