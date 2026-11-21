/**
 * App Scheduler Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { UnprocessableMediaError, type OllamaClient } from 'ai';
import {
  BlobStorage,
  SQLiteDatabase,
  ThumbnailStorage,
  VFSAPI,
  ensureWorkspace,
} from '../../vfs/src/lib';
import { ConfigStore } from '../src/config-store';
import { EventBus } from '../src/event-bus';
import { Scheduler } from '../src/scheduler';

function createFakeAi(): OllamaClient {
  return {
    isAvailable: () => true,
    classifyTagsByHash: async () => ({
      tags: ['cat'],
      aliases: {},
      confidence: 0.9,
      model: 'fake-model',
    }),
    renameByHash: async () => ({
      suggestedName: 'cute_cat',
      model: 'fake-model',
    }),
  } as unknown as OllamaClient;
}

describe('App Scheduler', () => {
  let workspace: string;
  let db: SQLiteDatabase;
  let api: VFSAPI;
  let store: ConfigStore;
  let events: EventBus;
  let scheduler: Scheduler;

  beforeEach(() => {
    workspace = path.join(
      os.tmpdir(),
      `app-scheduler-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    ensureWorkspace(workspace);
    db = new SQLiteDatabase(workspace);
    api = new VFSAPI(db, new BlobStorage(workspace), new ThumbnailStorage(workspace), workspace);
    store = new ConfigStore(workspace);
    store.load();
    events = new EventBus();
    scheduler = new Scheduler({ api, ai: createFakeAi(), config: store, events });
  });

  afterEach(() => {
    scheduler.stop();
    try {
      db.close();
    } catch {
      // Ignore cleanup errors.
    }
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('auto-enqueues paired tasks on ingest when the app wires the hook', async () => {
    api.setIngestHook((result) => {
      void scheduler.enqueuePair(result.hash);
    });

    const saved = api.saveFile({
      buffer: Buffer.from('image-content'),
      mimeType: 'image/jpeg',
    });

    // Allow the fire-and-forget enqueues to run.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const tasks = api.getTasksByHash(saved.hash);
    expect(tasks.map((task) => task.task_type).sort()).toEqual(['classify', 'rename']);
    expect(tasks.every((task) => task.status === 'pending')).toBe(true);
  });

  it('claims and completes pending tasks while running', async () => {
    const saved = api.saveFile({
      buffer: Buffer.from('scheduler-content'),
      mimeType: 'image/jpeg',
    });

    // Enqueue while paused so both tasks are pending before processing starts.
    await scheduler.enqueuePair(saved.hash);
    scheduler.updatePaused('classify', false);
    scheduler.updatePaused('rename', false);

    const completed = new Set<string>();
    const done = new Promise<void>((resolve) => {
      events.subscribe((event, data) => {
        if (event !== 'task:completed') return;
        const payload = data as { task_type: string };
        completed.add(payload.task_type);
        if (completed.size === 2) resolve();
      });
    });

    scheduler.start();
    await scheduler.runOnce();
    await done;

    const tasks = api.getTasksByHash(saved.hash);
    expect(tasks.every((task) => task.status === 'completed')).toBe(true);
  });

  it('does not claim tasks while paused', async () => {
    const saved = api.saveFile({
      buffer: Buffer.from('paused-content'),
      mimeType: 'image/jpeg',
    });
    await scheduler.enqueuePair(saved.hash);

    await scheduler.runOnce();

    const tasks = api.getTasksByHash(saved.hash);
    expect(tasks.every((task) => task.status === 'pending')).toBe(true);
  });

  it('recovers tasks left in processing', async () => {
    const saved = api.saveFile({
      buffer: Buffer.from('stale-content'),
      mimeType: 'image/jpeg',
    });
    api.enqueueTask({ taskType: 'classify', hash: saved.hash });
    api.updateTaskStatus({ taskType: 'classify', hash: saved.hash, status: 'processing' });

    const recovered = await scheduler.recoverStale();

    expect(recovered).toBe(1);
    const task = api.getTasksByHash(saved.hash).find((item) => item.task_type === 'classify');
    expect(task?.status).toBe('pending');
  });

  it('records skipped tasks for ineligible ingest without queueing work', async () => {
    api.setIngestHook((result) => {
      void scheduler.enqueuePair(result.hash);
    });

    const saved = api.saveFile({
      buffer: Buffer.from('icon-content'),
      mimeType: 'image/x-icon',
    });

    await vi.waitFor(() => {
      expect(api.getTasksByHash(saved.hash)).toHaveLength(2);
    });

    const tasks = api.getTasksByHash(saved.hash);
    expect(tasks.every((task) => task.status === 'skipped')).toBe(true);
    expect(tasks.every((task) => task.error?.includes('image/x-icon'))).toBe(true);
    expect(api.getQueueStatus().pending).toBe(0);
  });

  it('skips permanent unprocessable media after a single attempt', async () => {
    const failingAi = createFakeAi();
    failingAi.classifyTagsByHash = async (hash: string) => {
      throw new UnprocessableMediaError('unsupported-format', 'cannot decode', { hash });
    };
    const localScheduler = new Scheduler({ api, ai: failingAi, config: store, events });

    const saved = api.saveFile({
      buffer: Buffer.from('eligible-content'),
      mimeType: 'image/jpeg',
    });
    api.enqueueTask({ taskType: 'classify', hash: saved.hash });

    localScheduler.updatePaused('classify', false);
    localScheduler.start();
    await localScheduler.runOnce();

    await vi.waitFor(() => {
      const [task] = api.getTasksByHash(saved.hash);
      expect(task.status).toBe('skipped');
    });

    const [task] = api.getTasksByHash(saved.hash);
    expect(task.attempts).toBe(0);
    expect(task.error).toBe('cannot decode');
    localScheduler.stop();
  });

  it('keeps transient failures on the retry policy', async () => {
    const failingAi = createFakeAi();
    failingAi.classifyTagsByHash = async () => {
      throw new Error('ollama timeout');
    };
    const localScheduler = new Scheduler({ api, ai: failingAi, config: store, events });

    const saved = api.saveFile({
      buffer: Buffer.from('transient-content'),
      mimeType: 'image/jpeg',
    });
    api.enqueueTask({ taskType: 'classify', hash: saved.hash });

    localScheduler.updatePaused('classify', false);
    localScheduler.start();
    await localScheduler.runOnce();

    await vi.waitFor(() => {
      const [task] = api.getTasksByHash(saved.hash);
      expect(task.attempts).toBe(1);
      expect(task.status).toBe('pending');
    });

    localScheduler.stop();
  });

  it('pauses AI task types independently', async () => {
    const saved = api.saveFile({
      buffer: Buffer.from('independent-pause'),
      mimeType: 'image/jpeg',
    });
    await scheduler.enqueuePair(saved.hash);

    scheduler.updatePaused('classify', false);
    scheduler.updatePaused('rename', true);
    scheduler.start();

    await vi.waitFor(() => {
      const classify = api.getTasksByHash(saved.hash).find((task) => task.task_type === 'classify');
      expect(classify?.status).toBe('completed');
    });

    const rename = api.getTasksByHash(saved.hash).find((task) => task.task_type === 'rename');
    expect(rename?.status).toBe('pending');

    const renameDone = new Promise<void>((resolve) => {
      events.subscribe((event, data) => {
        if (event !== 'task:completed') return;
        if ((data as { task_type: string }).task_type === 'rename') resolve();
      });
    });

    scheduler.updatePaused('rename', false);
    await renameDone;

    expect(api.getTasksByHash(saved.hash).find((task) => task.task_type === 'rename')?.status).toBe(
      'completed'
    );
  });

  it('applies concurrency limits per task type', async () => {
    const savedA = api.saveFile({ buffer: Buffer.from('quota-a'), mimeType: 'image/jpeg' });
    const savedB = api.saveFile({ buffer: Buffer.from('quota-b'), mimeType: 'image/jpeg' });
    await scheduler.enqueuePair(savedA.hash);
    await scheduler.enqueuePair(savedB.hash);

    let classifyInFlight = 0;
    let renameInFlight = 0;
    let maxClassify = 0;
    let maxRename = 0;

    const slowAi = {
      isAvailable: () => true,
      classifyTagsByHash: async () => {
        classifyInFlight += 1;
        maxClassify = Math.max(maxClassify, classifyInFlight);
        await new Promise((resolve) => setTimeout(resolve, 25));
        classifyInFlight -= 1;
        return { tags: ['cat'], aliases: {}, confidence: 0.9, model: 'fake-model' };
      },
      renameByHash: async () => {
        renameInFlight += 1;
        maxRename = Math.max(maxRename, renameInFlight);
        await new Promise((resolve) => setTimeout(resolve, 25));
        renameInFlight -= 1;
        return { suggestedName: 'cute_cat', model: 'fake-model' };
      },
    } as unknown as OllamaClient;

    store.update({ classifyConcurrency: 1, renameConcurrency: 2 });
    const localScheduler = new Scheduler({ api, ai: slowAi, config: store, events });
    localScheduler.updatePaused('classify', false);
    localScheduler.updatePaused('rename', false);
    localScheduler.start();

    await vi.waitFor(
      () => {
        expect(api.getQueueStatus().completed).toBe(4);
      },
      { timeout: 5000 }
    );

    expect(maxClassify).toBe(1);
    expect(maxRename).toBe(2);
    localScheduler.stop();
  });

  it('reports per-type scheduler status and concurrency', () => {
    store.update({
      classifyConcurrency: 3,
      renameConcurrency: 2,
      classifyPaused: false,
      renamePaused: true,
    });
    const localScheduler = new Scheduler({ api, ai: createFakeAi(), config: store, events });

    const status = localScheduler.getSchedulerStatus();

    expect(status.state).toBe('running');
    expect(status.byType.classify).toEqual({
      state: 'running',
      processing: 0,
      concurrency: 3,
    });
    expect(status.byType.rename).toEqual({
      state: 'paused',
      processing: 0,
      concurrency: 2,
    });
  });
});
