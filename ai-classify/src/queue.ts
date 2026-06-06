/**
 * AI Classify - Task Queue Management
 */

import fs from 'fs-extra';
import path from 'path';
import { Queue, Task } from './types.js';

const QUEUE_FILE = 'queue.json';

export async function loadQueue(outputDir: string): Promise<Queue> {
  const queuePath = path.join(outputDir, QUEUE_FILE);

  if (await fs.pathExists(queuePath)) {
    const loaded = await fs.readJson(queuePath);
    // Restore processing items to pending on startup
    const processing = loaded.processing || [];
    const pending = loaded.pending || [];
    return {
      pending: [...processing, ...pending],
      processing: [],
      failed: loaded.failed || []
    };
  }

  return { pending: [], processing: [], failed: [] };
}

export async function saveQueue(outputDir: string, queue: Queue): Promise<void> {
  const queuePath = path.join(outputDir, QUEUE_FILE);
  await fs.writeJson(queuePath, queue, { spaces: 2 });
}

export function enqueue(queue: Queue, task: Task): Queue {
  // Check if already in queue
  const exists = queue.pending.some(t => t.path === task.path) ||
                 queue.processing.some(t => t.path === task.path);

  if (exists) {
    return queue;
  }

  queue.pending.push(task);
  // Sort by priority (higher first)
  queue.pending.sort((a, b) => b.priority - a.priority);
  return queue;
}

export function dequeue(queue: Queue): Task | null {
  if (queue.pending.length === 0) {
    return null;
  }

  const task = queue.pending.shift()!;
  task.status = 'processing';
  queue.processing.push(task);
  return task;
}

export function markComplete(queue: Queue, task: Task): Queue {
  queue.processing = queue.processing.filter(t => t.path !== task.path);
  return queue;
}

export function markFailed(queue: Queue, task: Task, error: string): Queue {
  queue.processing = queue.processing.filter(t => t.path !== task.path);
  task.status = 'failed';
  task.error = error;
  queue.failed.push(task);
  return queue;
}

export function getQueueStats(queue: Queue) {
  return {
    pending: queue.pending.length,
    processing: queue.processing.length,
    failed: queue.failed.length,
    total: queue.pending.length + queue.processing.length + queue.failed.length
  };
}

export async function clearQueue(outputDir: string): Promise<void> {
  const queuePath = path.join(outputDir, QUEUE_FILE);
  if (await fs.pathExists(queuePath)) {
    await fs.unlink(queuePath);
  }
}