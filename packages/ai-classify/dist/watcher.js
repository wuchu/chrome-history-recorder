/**
 * AI Classify - Directory Watcher
 */
import chokidar from 'chokidar';
import fs from 'fs-extra';
import path from 'path';
import { computeFileHash } from './hashIndex.js';
// Supported media file extensions
const MEDIA_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.mp4'];
function isMediaFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MEDIA_EXTENSIONS.includes(ext);
}
export class Watcher {
    watcher = null;
    config;
    onFileDetected;
    constructor(config, onFileDetected) {
        this.config = config;
        this.onFileDetected = onFileDetected;
    }
    async start() {
        await fs.ensureDir(this.config.input);
        this.watcher = chokidar.watch(this.config.input, {
            ignored: this.config.ignorePatterns,
            persistent: true,
            ignoreInitial: false,
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100,
            },
        });
        this.watcher.on('add', async (filePath) => {
            await this.handleFileAdded(filePath);
        });
        this.watcher.on('change', async (filePath) => {
            await this.handleFileAdded(filePath);
        });
        this.watcher.on('unlink', (filePath) => {
            // File removed - log but don't process
            console.log(`File removed: ${filePath}`);
        });
        console.log(`Watching directory: ${this.config.input}`);
    }
    async stop() {
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
    }
    async handleFileAdded(filePath) {
        try {
            const stat = await fs.stat(filePath);
            // Skip directories
            if (!stat.isFile()) {
                return;
            }
            // Skip non-media files
            if (!isMediaFile(filePath)) {
                return;
            }
            // Check file size
            if (stat.size > this.config.maxFileSize) {
                console.log(`File too large, skipping: ${filePath}`);
                return;
            }
            // Check file size (skip empty files)
            if (stat.size === 0) {
                console.log(`Empty file, skipping: ${filePath}`);
                return;
            }
            // Compute hash
            const hash = await computeFileHash(filePath);
            // Create task
            const task = {
                path: filePath,
                hash,
                addedAt: new Date().toISOString(),
                priority: 0,
                status: 'pending',
            };
            this.onFileDetected(task);
            console.log(`File detected: ${filePath}`);
        }
        catch (error) {
            console.error(`Error handling file: ${filePath}`, error);
        }
    }
}
export async function scanExistingFiles(config) {
    const tasks = [];
    await fs.ensureDir(config.input);
    const scan = async (dir) => {
        const files = await fs.readdir(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) {
                await scan(filePath);
            }
            else if (stat.isFile()) {
                // Skip non-media files
                if (!isMediaFile(filePath)) {
                    continue;
                }
                // Check size and patterns
                if (stat.size > config.maxFileSize || stat.size === 0) {
                    continue;
                }
                const hash = await computeFileHash(filePath);
                tasks.push({
                    path: filePath,
                    hash,
                    addedAt: new Date().toISOString(),
                    priority: 0,
                    status: 'pending',
                });
            }
        }
    };
    await scan(config.input);
    return tasks;
}
//# sourceMappingURL=watcher.js.map