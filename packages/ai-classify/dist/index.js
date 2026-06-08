/**
 * AI Classify - Main Module
 */
import fs from 'fs-extra';
import { initEventLog, loadState, appendEvent, compact as compactEventLog, clearEventLog, createEnqueueEvent, createStartEvent, createCompleteEvent, createFailEvent, COMPACT_THRESHOLD_LINES } from './eventLog.js';
import { hasBeenProcessed, addProcessedRecord } from './hashIndex.js';
import { classifyFile, checkOllamaHealth } from './classifier.js';
import { organizeFile, createIndexRecord } from './organizer.js';
import { Watcher, scanExistingFiles } from './watcher.js';
export class AIClassify {
    config;
    configDir;
    pending = [];
    processing = [];
    failed = [];
    index = { processed: {} };
    watcher = null;
    processingFlag = false;
    activeCount = 0;
    eventCount = 0;
    constructor(config, configDir) {
        this.config = config;
        this.configDir = configDir;
    }
    async initialize() {
        // Ensure output directory exists
        await fs.ensureDir(this.config.output);
        // Initialize event log
        await initEventLog(this.configDir);
        // Load state from event log
        const state = await loadState(this.configDir, this.config.output);
        this.pending = state.pending;
        this.processing = state.processing;
        this.failed = state.failed;
        this.index = state.index;
        // Compact if needed
        if (state.needsCompact) {
            await this.doCompact();
        }
        // Check Ollama health
        const healthy = await checkOllamaHealth(this.config);
        if (!healthy) {
            console.warn('Warning: Ollama service not available');
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
        // Compact on normal exit
        await this.doCompact();
        console.log('AI Classify stopped');
    }
    async addTask(task) {
        // Check if already processed
        if (hasBeenProcessed(this.index, task.hash)) {
            console.log(`File already processed: ${task.path}`);
            return;
        }
        // Check if already in queue
        const inPending = this.pending.some(t => t.path === task.path);
        const inProcessing = this.processing.some(t => t.path === task.path);
        if (inPending || inProcessing) {
            console.log(`File already in queue: ${task.path}`);
            return;
        }
        // Add to pending
        this.pending.push(task);
        this.pending.sort((a, b) => b.priority - a.priority);
        // Append ENQUEUE event
        await appendEvent(this.configDir, createEnqueueEvent(task));
        this.eventCount++;
        // Trigger processing
        if (!this.processingFlag) {
            this.processQueue();
        }
    }
    async processQueue() {
        this.processingFlag = true;
        while (this.pending.length > 0 && this.activeCount < this.config.concurrency) {
            const task = this.pending.shift();
            if (task) {
                this.activeCount++;
                this.processTask(task)
                    .then(() => {
                    this.activeCount--;
                    // Continue processing remaining tasks after one completes
                    if (this.pending.length > 0) {
                        this.processQueue();
                    }
                })
                    .catch((error) => {
                    this.activeCount--;
                    // Continue processing remaining tasks after one fails
                    if (this.pending.length > 0) {
                        this.processQueue();
                    }
                });
            }
        }
        this.processingFlag = false;
    }
    async processTask(task) {
        // Check if input file exists
        if (!await fs.pathExists(task.path)) {
            console.warn(`Input file not found: ${task.path}`);
            await appendEvent(this.configDir, createFailEvent(task.path, 'Input file not found'));
            this.eventCount++;
            this.failed.push({ ...task, status: 'failed', error: 'Input file not found' });
            return;
        }
        try {
            // Append START event
            const startEvent = createStartEvent(task);
            await appendEvent(this.configDir, startEvent);
            this.eventCount++;
            // Update memory state
            task.status = 'processing';
            this.processing.push(task);
            console.log(`Processing: ${task.path}`);
            // Classify file
            const classification = await classifyFile(task.path, this.config);
            // Organize file
            const { outputPath, hash } = await organizeFile(task.path, classification, this.config, task.hash);
            // Append COMPLETE event
            await appendEvent(this.configDir, createCompleteEvent(task.path, hash, outputPath, classification.category));
            this.eventCount++;
            // Update memory state
            this.processing = this.processing.filter(t => t.path !== task.path);
            const record = createIndexRecord(outputPath, classification.category, task.path);
            this.index = addProcessedRecord(this.index, hash, record);
            console.log(`Completed: ${task.path} -> ${outputPath}`);
            // Check if should compact
            if (this.shouldCompact()) {
                await this.doCompact();
            }
        }
        catch (error) {
            // Append FAIL event
            await appendEvent(this.configDir, createFailEvent(task.path, error.message));
            this.eventCount++;
            // Update memory state
            this.processing = this.processing.filter(t => t.path !== task.path);
            this.failed.push({ ...task, status: 'failed', error: error.message });
            console.error(`Failed: ${task.path} - ${error.message}`);
            // Check if should compact
            if (this.shouldCompact()) {
                await this.doCompact();
            }
        }
    }
    shouldCompact() {
        return this.eventCount > COMPACT_THRESHOLD_LINES;
    }
    async doCompact() {
        await compactEventLog(this.configDir, {
            pending: this.pending,
            processing: this.processing,
            failed: this.failed,
            index: this.index
        });
        this.eventCount = 0;
    }
    async scanAndEnqueue() {
        const tasks = await scanExistingFiles(this.config);
        let queuedCount = 0;
        for (const task of tasks) {
            if (!hasBeenProcessed(this.index, task.hash)) {
                // Check if already in queue
                const inPending = this.pending.some(t => t.path === task.path);
                const inProcessing = this.processing.some(t => t.path === task.path);
                if (!inPending && !inProcessing) {
                    this.pending.push(task);
                    await appendEvent(this.configDir, createEnqueueEvent(task));
                    this.eventCount++;
                    queuedCount++;
                }
            }
        }
        // Sort by priority
        this.pending.sort((a, b) => b.priority - a.priority);
        console.log(`Scanned ${tasks.length} files, queued ${queuedCount}`);
    }
    getStatus() {
        return {
            queue: {
                pending: this.pending.length,
                processing: this.processing.length,
                failed: this.failed.length,
                total: this.pending.length + this.processing.length + this.failed.length
            },
            indexSize: Object.keys(this.index.processed).length
        };
    }
    async clear() {
        this.pending = [];
        this.processing = [];
        this.failed = [];
        this.index = { processed: {} };
        this.eventCount = 0;
        await clearEventLog(this.configDir);
    }
}
//# sourceMappingURL=index.js.map