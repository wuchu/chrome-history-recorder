/**
 * App Scheduler Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { OllamaClient } from 'ai';
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
});
