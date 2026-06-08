import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  initEventLog,
  loadState,
  appendEvent,
  clearEventLog,
  createEnqueueEvent,
  createStartEvent,
  createCompleteEvent,
  createFailEvent,
} from '../src/eventLog.js';
import type { Task } from '../src/types.js';

const TEST_DIR = '/tmp/ai-classify-test-' + Date.now();
const OUTPUT_DIR = path.join(TEST_DIR, 'output');

const createMockTask = (index: number): Task => ({
  path: `/test/file${index}.jpg`,
  hash: `hash${index}`,
  addedAt: new Date().toISOString(),
  priority: 0,
  status: 'pending',
});

describe('eventLog', () => {
  beforeEach(async () => {
    await fs.ensureDir(OUTPUT_DIR);
    await initEventLog(TEST_DIR);
  });

  afterEach(async () => {
    await fs.remove(TEST_DIR);
  });

  describe('initEventLog', () => {
    it('should create log file if not exists', async () => {
      const logPath = path.join(TEST_DIR, '.ai-classify-events.log');
      expect(await fs.pathExists(logPath)).toBe(true);
    });
  });

  describe('loadState', () => {
    it('should return empty state when no events', async () => {
      const state = await loadState(TEST_DIR, OUTPUT_DIR);
      expect(state.pending).toHaveLength(0);
      expect(state.processing).toHaveLength(0);
      expect(state.failed).toHaveLength(0);
      expect(state.needsCompact).toBe(false);
    });

    it('should load state from events', async () => {
      const task = createMockTask(1);
      await appendEvent(TEST_DIR, createEnqueueEvent(task));

      const state = await loadState(TEST_DIR, OUTPUT_DIR);
      expect(state.pending).toHaveLength(1);
      expect(state.pending[0].path).toBe(task.path);
    });
  });

  describe('appendEvent', () => {
    it('should append ENQUEUE event', async () => {
      const task = createMockTask(1);
      await appendEvent(TEST_DIR, createEnqueueEvent(task));

      const state = await loadState(TEST_DIR, OUTPUT_DIR);
      expect(state.pending).toHaveLength(1);
    });

    it('should append START event', async () => {
      const task = createMockTask(1);
      await appendEvent(TEST_DIR, createEnqueueEvent(task));
      await appendEvent(TEST_DIR, createStartEvent(task));

      const state = await loadState(TEST_DIR, OUTPUT_DIR);
      // START event creates a zombie task (processing but no output)
      // It will be moved back to pending during recovery
      expect(state.pending).toHaveLength(1);
      expect(state.processing).toHaveLength(0);
    });

    it('should append COMPLETE event', async () => {
      const task = createMockTask(1);
      await appendEvent(TEST_DIR, createEnqueueEvent(task));
      await appendEvent(TEST_DIR, createStartEvent(task));
      await appendEvent(
        TEST_DIR,
        createCompleteEvent(task.path, task.hash, '/output/test.jpg', 'photo')
      );

      const state = await loadState(TEST_DIR, OUTPUT_DIR);
      expect(state.processing).toHaveLength(0);
      expect(Object.keys(state.index.processed)).toHaveLength(1);
    });

    it('should append FAIL event', async () => {
      const task = createMockTask(1);
      await appendEvent(TEST_DIR, createEnqueueEvent(task));
      await appendEvent(TEST_DIR, createStartEvent(task));
      await appendEvent(TEST_DIR, createFailEvent(task.path, 'Test error'));

      const state = await loadState(TEST_DIR, OUTPUT_DIR);
      expect(state.failed).toHaveLength(1);
    });
  });

  describe('clearEventLog', () => {
    it('should clear log file', async () => {
      const task = createMockTask(1);
      await appendEvent(TEST_DIR, createEnqueueEvent(task));
      await clearEventLog(TEST_DIR);

      const state = await loadState(TEST_DIR, OUTPUT_DIR);
      expect(state.pending).toHaveLength(0);
    });
  });
});
