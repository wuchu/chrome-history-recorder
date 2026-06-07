/**
 * AI Classify - Main Module
 */

import fs from 'fs-extra';
import { Config, Task, Queue, HashIndex } from './types.js';
import { loadQueue, saveQueue, enqueue, dequeue, markComplete, markFailed, getQueueStats } from './queue.js';
import { loadIndex, saveIndex, hasBeenProcessed, addProcessedRecord, computeFileHash } from './hashIndex.js';
import { classifyFile, checkOllamaHealth } from './classifier.js';
import { organizeFile, createIndexRecord } from './organizer.js';
import { Watcher, scanExistingFiles } from './watcher.js';

export class AIClassify {
  private config: Config;
  private queue!: Queue;
  private index!: HashIndex;
  private watcher: Watcher | null = null;
  private processing: boolean = false;
  private activeCount: number = 0;

  constructor(config: Config) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Ensure output directory exists
    await fs.ensureDir(this.config.output);

    // Load queue and index
    this.queue = await loadQueue(this.config.output);
    this.index = await loadIndex(this.config.output);

    // Check Ollama health
    const healthy = await checkOllamaHealth(this.config);
    if (!healthy) {
      console.warn('Warning: Ollama service not available');
    }
  }

  async start(): Promise<void> {
    // Process existing queue first
    await this.processQueue();

    // Start watching for new files
    this.watcher = new Watcher(this.config, async (task: Task) => {
      await this.addTask(task);
    });
    await this.watcher.start();

    console.log('AI Classify started');
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.stop();
    }

    // Wait for current processing to complete
    while (this.activeCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Save state
    await this.saveState();

    console.log('AI Classify stopped');
  }

  async addTask(task: Task): Promise<void> {
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

  private async processQueue(): Promise<void> {
    this.processing = true;

    while (this.queue.pending.length > 0 && this.activeCount < this.config.concurrency) {
      const task = dequeue(this.queue);

      if (task) {
        this.activeCount++;
        this.processTask(task)
          .then(() => {
            this.activeCount--;
            this.saveState();
          })
          .catch((error) => {
            this.activeCount--;
            this.queue = markFailed(this.queue, task, error.message);
            this.saveState();
          });
      }
    }

    this.processing = false;
  }

  private async processTask(task: Task): Promise<void> {
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
    } catch (error: any) {
      throw new Error(`Failed to process ${task.path}: ${error.message}`);
    }
  }

  private async saveState(): Promise<void> {
    await saveQueue(this.config.output, this.queue);
    await saveIndex(this.config.output, this.index);
  }

  async scanAndEnqueue(): Promise<void> {
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

  async clear(): Promise<void> {
    this.queue = { pending: [], processing: [], failed: [] };
    this.index = { processed: {} };
    await this.saveState();
  }
}