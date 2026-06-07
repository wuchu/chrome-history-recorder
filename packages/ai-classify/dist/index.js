/**
 * AI Classify - Main Module
 */
import fs from 'fs-extra';
import path from 'path';
import { loadQueue, saveQueue, enqueue, dequeue, markComplete, markFailed, getQueueStats } from './queue.js';
import { loadIndex, saveIndex, hasBeenProcessed, addProcessedRecord } from './hashIndex.js';
import { classifyFile, checkOllamaHealth } from './classifier.js';
import { organizeFile, createIndexRecord } from './organizer.js';
import { Watcher, scanExistingFiles } from './watcher.js';
export class AIClassify {
    config;
    configDir;
    queue;
    index;
    watcher = null;
    processing = false;
    activeCount = 0;
    constructor(config, configDir) {
        this.config = config;
        this.configDir = configDir;
    }
    async initialize() {
        // Ensure output directory exists
        await fs.ensureDir(this.config.output);
        // Migrate old files if they exist
        await this.migrateOldFiles();
        // Load queue and index from configDir
        this.queue = await loadQueue(this.configDir);
        this.index = await loadIndex(this.configDir);
        // Check Ollama health
        const healthy = await checkOllamaHealth(this.config);
        if (!healthy) {
            console.warn('Warning: Ollama service not available');
        }
    }
    /**
     * Migrate old index.json and queue.json from output directory to config directory
     */
    async migrateOldFiles() {
        const oldIndexFile = path.join(this.config.output, 'index.json');
        const oldQueueFile = path.join(this.config.output, 'queue.json');
        const newIndexFile = path.join(this.configDir, '.ai-classify-index.json');
        const newQueueFile = path.join(this.configDir, '.ai-classify-queue-tasks.json');
        // Migrate index file
        if (await fs.pathExists(oldIndexFile) && !(await fs.pathExists(newIndexFile))) {
            console.log(`Migrating index file: ${oldIndexFile} -> ${newIndexFile}`);
            await fs.move(oldIndexFile, newIndexFile);
        }
        // Migrate queue file
        if (await fs.pathExists(oldQueueFile) && !(await fs.pathExists(newQueueFile))) {
            console.log(`Migrating queue file: ${oldQueueFile} -> ${newQueueFile}`);
            await fs.move(oldQueueFile, newQueueFile);
        }
    }
    async start() {
        // Scan input directory for existing files first
        await this.scanAndEnqueue();
        // Process existing queue (including recovered from last session)
        await this.processQueue();
        // Start watching for new files
        this.watcher = new Watcher(this.config, async (task) => {
            await this.addTask(task);
        });
        await this.watcher.start();
        console.log('AI Classify started');
    }
    async stop() {
        if (this.watcher) {
            await this.watcher.stop();
        }
        // Wait for current processing to complete (with timeout)
        const maxWaitTime = 5000; // 最多等待5秒
        const startTime = Date.now();
        while (this.activeCount > 0 && Date.now() - startTime < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (this.activeCount > 0) {
            console.warn(`Warning: ${this.activeCount} tasks still processing, forcing exit`);
        }
        // Save state
        await this.saveState();
        console.log('AI Classify stopped');
    }
    async addTask(task) {
        // Check if already processed
        if (hasBeenProcessed(this.index, task.hash)) {
            console.log(`File already processed: ${task.path}`);
            return;
        }
        this.queue = enqueue(this.queue, task);
        await this.saveState();
        // Trigger processing
        if (!this.processing) {
            this.processQueue();
        }
    }
    async processQueue() {
        this.processing = true;
        while (this.queue.pending.length > 0 && this.activeCount < this.config.concurrency) {
            const task = dequeue(this.queue);
            if (task) {
                this.activeCount++;
                this.processTask(task)
                    .then(() => {
                    this.activeCount--;
                    this.saveState();
                    // Continue processing remaining tasks after one completes
                    if (this.queue.pending.length > 0) {
                        this.processQueue();
                    }
                })
                    .catch((error) => {
                    this.activeCount--;
                    this.queue = markFailed(this.queue, task, error.message);
                    this.saveState();
                    // Continue processing remaining tasks after one fails
                    if (this.queue.pending.length > 0) {
                        this.processQueue();
                    }
                });
            }
        }
        this.processing = false;
    }
    async processTask(task) {
        try {
            console.log(`Processing: ${task.path}`);
            // Classify file
            const classification = await classifyFile(task.path, this.config);
            // Organize file
            const { outputPath, hash } = await organizeFile(task.path, classification, this.config, task.hash);
            // Update index
            const record = createIndexRecord(outputPath, classification.category, task.path);
            this.index = addProcessedRecord(this.index, hash, record);
            // Mark complete
            this.queue = markComplete(this.queue, task);
            console.log(`Completed: ${task.path} -> ${outputPath}`);
        }
        catch (error) {
            throw new Error(`Failed to process ${task.path}: ${error.message}`);
        }
    }
    async saveState() {
        await saveQueue(this.configDir, this.queue);
        await saveIndex(this.configDir, this.index);
    }
    async scanAndEnqueue() {
        const tasks = await scanExistingFiles(this.config);
        for (const task of tasks) {
            if (!hasBeenProcessed(this.index, task.hash)) {
                this.queue = enqueue(this.queue, task);
            }
        }
        await this.saveState();
        console.log(`Scanned ${tasks.length} files, queued ${getQueueStats(this.queue).pending}`);
    }
    getStatus() {
        return {
            queue: getQueueStats(this.queue),
            indexSize: Object.keys(this.index.processed).length
        };
    }
    async clear() {
        this.queue = { pending: [], processing: [], failed: [] };
        this.index = { processed: {} };
        await this.saveState();
    }
}
//# sourceMappingURL=index.js.map