/**
 * AI Classify - Event Log Management
 *
 * Append-only event log for reliable state persistence.
 * Supports crash recovery, zombie task handling, and periodic compaction.
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { Task, HashIndex, IndexRecord } from './types.js';

// Constants
export const LOG_FILE = '.ai-classify-events.log';
export const COMPACT_THRESHOLD_LINES = 500;
export const COMPACT_THRESHOLD_SIZE = 100 * 1024; // 100KB

// Event Types
export type EventType = 'ENQUEUE' | 'START' | 'COMPLETE' | 'FAIL' | 'RETRY' | 'COMPACT';

// Event Data Structures
export interface Event {
  type: EventType;
  ts: string; // ISO timestamp with millisecond precision
  path?: string; // All events need path for tracking
  task?: Task; // ENQUEUE, START, RETRY events
  hash?: string; // COMPLETE event
  output?: string; // COMPLETE event
  category?: string; // COMPLETE event
  error?: string; // FAIL event
  snapshot?: StateSnapshot; // COMPACT event only
}

export interface StateSnapshot {
  pending: Task[];
  processing: Task[];
  failed: Task[];
  index: HashIndex;
}

export interface RecoveredState extends StateSnapshot {
  needsCompact: boolean;
}

// Write lock for concurrent protection
let writeLock: Promise<void> = Promise.resolve();

/**
 * Initialize event log - ensure log file exists
 */
export async function initEventLog(configDir: string): Promise<void> {
  const logPath = path.join(configDir, LOG_FILE);
  if (!(await fs.pathExists(logPath))) {
    await fs.writeFile(logPath, '');
  }
}

/**
 * Append event to log with write lock protection
 */
export async function appendEvent(configDir: string, event: Event): Promise<void> {
  const logPath = path.join(configDir, LOG_FILE);
  const line = JSON.stringify(event) + '\n';

  // Use write lock to serialize concurrent writes
  writeLock = writeLock.then(async () => {
    await fs.appendFile(logPath, line);
  });

  return writeLock;
}

/**
 * Parse single JSON line to event
 */
function parseEvent(line: string): Event | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Get current timestamp with millisecond precision
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Rebuild state from event list
 */
function replayEvents(events: Event[]): StateSnapshot {
  const state: StateSnapshot = {
    pending: [],
    processing: [],
    failed: [],
    index: { processed: {} },
  };

  // Find the last COMPACT event first
  let lastCompactIndex = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === 'COMPACT') {
      lastCompactIndex = i;
      break;
    }
  }

  // If COMPACT exists, start from its snapshot
  if (lastCompactIndex >= 0 && events[lastCompactIndex].snapshot) {
    const snapshot = events[lastCompactIndex].snapshot!;
    state.pending = [...snapshot.pending];
    state.processing = [...snapshot.processing];
    state.failed = [...snapshot.failed];
    state.index = { processed: { ...snapshot.index.processed } };

    // Replay events after COMPACT
    for (let i = lastCompactIndex + 1; i < events.length; i++) {
      applyEvent(state, events[i]);
    }
  } else {
    // No COMPACT, replay all events
    for (const event of events) {
      applyEvent(state, event);
    }
  }

  return state;
}

/**
 * Apply single event to state
 */
function applyEvent(state: StateSnapshot, event: Event): void {
  switch (event.type) {
    case 'ENQUEUE':
      if (event.task) {
        // Check if already in queue
        const exists =
          state.pending.some((t) => t.path === event.task!.path) ||
          state.processing.some((t) => t.path === event.task!.path);
        if (!exists) {
          state.pending.push(event.task);
          // Sort by priority (higher first)
          state.pending.sort((a, b) => b.priority - a.priority);
        }
      }
      break;

    case 'START':
      if (event.task) {
        // Remove from pending, add to processing
        state.pending = state.pending.filter((t) => t.path !== event.task!.path);
        const procTask = { ...event.task, status: 'processing' as const };
        state.processing.push(procTask);
      }
      break;

    case 'COMPLETE':
      if (event.path && event.hash) {
        // Remove from processing
        state.processing = state.processing.filter((t) => t.path !== event.path);
        // Add to index
        if (event.output && event.category) {
          const record: IndexRecord = {
            outputPath: event.output,
            processedAt: event.ts,
            category: event.category,
            originalPath: event.path,
          };
          state.index.processed[event.hash] = record;
        }
      }
      break;

    case 'FAIL':
      if (event.path && event.error) {
        // Find task in processing
        const task = state.processing.find((t) => t.path === event.path);
        if (task) {
          state.processing = state.processing.filter((t) => t.path !== event.path);
          const failedTask = { ...task, status: 'failed' as const, error: event.error };
          state.failed.push(failedTask);
        }
      }
      break;

    case 'RETRY':
      if (event.task) {
        // Remove from failed, add to pending
        state.failed = state.failed.filter((t) => t.path !== event.task!.path);
        const retryTask = { ...event.task, status: 'pending' as const, error: undefined };
        // Check if already in queue
        const exists =
          state.pending.some((t) => t.path === event.task!.path) ||
          state.processing.some((t) => t.path === event.task!.path);
        if (!exists) {
          state.pending.push(retryTask);
          state.pending.sort((a, b) => b.priority - a.priority);
        }
      }
      break;

    case 'COMPACT':
      // COMPACT is handled separately in replayEvents
      break;
  }
}

/**
 * Handle zombie task - check if completed or needs reprocess
 */
async function handleZombieTask(
  task: Task,
  index: HashIndex,
  outputDir: string
): Promise<'completed' | 'reprocess'> {
  // Check if already in index
  if (index.processed[task.hash]) {
    // Task completed, just didn't write COMPLETE event
    return 'completed';
  }

  // Check for residual output files
  // Scan output directory for files matching this hash
  const residualFile = await findFileByHash(outputDir, task.hash);
  if (residualFile) {
    // Clean up residual file
    try {
      await fs.unlink(residualFile);
      console.log(`Cleaned up residual file: ${residualFile}`);
    } catch (err) {
      console.warn(`Failed to clean residual file: ${residualFile}`, err);
    }
  }

  return 'reprocess';
}

/**
 * Find file by hash in output directory
 */
async function findFileByHash(outputDir: string, targetHash: string): Promise<string | null> {
  if (!(await fs.pathExists(outputDir))) {
    return null;
  }

  const scan = async (dir: string): Promise<string | null> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const found = await scan(fullPath);
        if (found) return found;
      } else if (entry.isFile()) {
        try {
          const content = await fs.readFile(fullPath);
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          if (hash === targetHash) {
            return fullPath;
          }
        } catch {
          // Skip unreadable files
        }
      }
    }

    return null;
  };

  return scan(outputDir);
}

/**
 * Load state from event log
 */
export async function loadState(configDir: string, outputDir: string): Promise<RecoveredState> {
  const logPath = path.join(configDir, LOG_FILE);

  if (!(await fs.pathExists(logPath))) {
    // First run - empty state
    return {
      pending: [],
      processing: [],
      failed: [],
      index: { processed: {} },
      needsCompact: false,
    };
  }

  try {
    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.split('\n');
    const events: Event[] = [];
    const corruptLines: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const event = parseEvent(lines[i]);
      if (event) {
        events.push(event);
      } else if (lines[i].trim()) {
        // Non-empty line that failed to parse
        corruptLines.push(i + 1);
      }
    }

    if (corruptLines.length > 0) {
      console.warn(`Warning: Log file has ${corruptLines.length} corrupted lines, skipping them`);
    }

    // Replay events to build state
    const state = replayEvents(events);

    // Handle zombie tasks (processing tasks from crash)
    const zombieTasks = [...state.processing];
    state.processing = [];

    for (const zombie of zombieTasks) {
      const result = await handleZombieTask(zombie, state.index, outputDir);

      if (result === 'completed') {
        // Already done, just remove from processing
        console.log(`Zombie task already completed: ${zombie.path}`);
      } else {
        // Need to reprocess
        const retryTask = { ...zombie, status: 'pending' as const };
        state.pending.push(retryTask);
        state.pending.sort((a, b) => b.priority - a.priority);
        console.log(`Zombie task needs reprocess: ${zombie.path}`);
      }
    }

    // Check if needs compact
    const needsCompact =
      lines.length > COMPACT_THRESHOLD_LINES || content.length > COMPACT_THRESHOLD_SIZE;

    return {
      ...state,
      needsCompact,
    };
  } catch (err) {
    console.warn(`Warning: Failed to read event log, starting with empty state`, err);
    return {
      pending: [],
      processing: [],
      failed: [],
      index: { processed: {} },
      needsCompact: false,
    };
  }
}

/**
 * Compact event log - write snapshot and truncate old events
 */
export async function compact(configDir: string, state: StateSnapshot): Promise<void> {
  const logPath = path.join(configDir, LOG_FILE);

  const compactEvent: Event = {
    type: 'COMPACT',
    ts: getTimestamp(),
    snapshot: {
      pending: state.pending,
      processing: state.processing,
      failed: state.failed,
      index: state.index,
    },
  };

  // Write COMPACT event first (with write lock)
  await appendEvent(configDir, compactEvent);

  // Wait for write lock to complete
  await writeLock;

  // Now read file and keep only the last COMPACT
  const content = await fs.readFile(logPath, 'utf-8');
  const lines = content.split('\n');
  const events: Event[] = [];

  for (const line of lines) {
    const event = parseEvent(line);
    if (event) {
      events.push(event);
    }
  }

  // Find last COMPACT index
  let lastCompactIndex = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === 'COMPACT') {
      lastCompactIndex = i;
      break;
    }
  }

  // Keep only the last COMPACT and events after it
  const keepEvents = events.slice(lastCompactIndex);

  // Rewrite file with only kept events
  const newContent = keepEvents.map((e) => JSON.stringify(e)).join('\n') + '\n';
  await fs.writeFile(logPath, newContent);

  console.log(`Log compacted: ${lines.length} lines -> ${keepEvents.length} events`);
}

/**
 * Clear event log
 */
export async function clearEventLog(configDir: string): Promise<void> {
  const logPath = path.join(configDir, LOG_FILE);
  if (await fs.pathExists(logPath)) {
    await fs.unlink(logPath);
  }
}

/**
 * Helper: Create ENQUEUE event
 */
export function createEnqueueEvent(task: Task): Event {
  return {
    type: 'ENQUEUE',
    ts: getTimestamp(),
    path: task.path,
    task,
  };
}

/**
 * Helper: Create START event
 */
export function createStartEvent(task: Task): Event {
  return {
    type: 'START',
    ts: getTimestamp(),
    path: task.path,
    task,
  };
}

/**
 * Helper: Create COMPLETE event
 */
export function createCompleteEvent(
  path: string,
  hash: string,
  output: string,
  category: string
): Event {
  return {
    type: 'COMPLETE',
    ts: getTimestamp(),
    path,
    hash,
    output,
    category,
  };
}

/**
 * Helper: Create FAIL event
 */
export function createFailEvent(path: string, error: string): Event {
  return {
    type: 'FAIL',
    ts: getTimestamp(),
    path,
    error,
  };
}

/**
 * Helper: Create RETRY event
 */
export function createRetryEvent(task: Task): Event {
  return {
    type: 'RETRY',
    ts: getTimestamp(),
    path: task.path,
    task,
  };
}
