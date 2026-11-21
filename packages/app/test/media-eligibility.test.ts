/**
 * App handler eligibility tests.
 *
 * Verifies that manual enqueue, single requeue, retry-failed, and full rescan
 * never create pending work for ineligible media.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { OllamaClient } from 'ai';
import { BlobStorage, SQLiteDatabase, ThumbnailStorage, VFSAPI, ensureWorkspace } from 'vfs';
import { ConfigStore } from '../src/config-store';
import { EventBus } from '../src/event-bus';
import { createAppExternalHandler } from '../src/handlers';
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
    renameByHash: async () => ({ suggestedName: 'cute_cat', model: 'fake-model' }),
  } as unknown as OllamaClient;
}

describe('App handler media eligibility', () => {
  let workspace: string;
  let db: SQLiteDatabase;
  let api: VFSAPI;
  let store: ConfigStore;
  let events: EventBus;
  let scheduler: Scheduler;
  let handler: ReturnType<typeof createAppExternalHandler>;

  beforeEach(() => {
    workspace = path.join(
      os.tmpdir(),
      `app-eligibility-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    ensureWorkspace(workspace);
    db = new SQLiteDatabase(workspace);
    api = new VFSAPI(db, new BlobStorage(workspace), new ThumbnailStorage(workspace), workspace);
    store = new ConfigStore(workspace);
    store.load();
    events = new EventBus();
    scheduler = new Scheduler({ api, ai: createFakeAi(), config: store, events });
    handler = createAppExternalHandler({
      api,
      ai: createFakeAi(),
      store,
      scheduler,
      events,
      workspace: {
        getInfo: () => ({}) as never,
        setPath: () => ({}) as never,
      },
      mediaArchive: {
        getStatus: () => ({}) as never,
        updateConfig: () => ({}) as never,
        runNow: () => ({}) as never,
      },
    });
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

  function save(mimeType: string, content: string): string {
    return api.saveFile({ buffer: Buffer.from(content), mimeType }).hash;
  }

  function failOnce(hash: string): void {
    api.enqueueTask({ taskType: 'classify', hash, maxAttempts: 1 });
    api.updateTaskStatus({
      taskType: 'classify',
      hash,
      status: 'failed',
      error: 'boom',
      retryDelayMs: 0,
    });
  }

  it('records skipped work when enqueueing ineligible media', async () => {
    const ico = save('image/x-icon', 'icon');

    const result = await handler('enqueueTask', { taskType: 'classify', hash: ico });

    expect(result).toMatchObject({ success: true });
    expect(api.getTasksByHash(ico)[0].status).toBe('skipped');
  });

  it('returns an actionable reason for a single ineligible requeue', async () => {
    const ico = save('image/x-icon', 'icon');

    const result = (await handler('requeueTask', { taskType: 'classify', hash: ico })) as {
      success: boolean;
      skipped: boolean;
      reason?: string;
    };

    expect(result.success).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('image/x-icon');
    expect(api.getTasksByHash(ico)[0].status).toBe('skipped');
  });

  it('splits retry-failed into skipped and pending by eligibility', async () => {
    const ico = save('image/x-icon', 'icon');
    const png = save('image/png', 'png');
    failOnce(ico);
    failOnce(png);

    const result = (await handler('retryFailedTasks', { taskType: 'classify' })) as {
      count: number;
    };

    expect(result.count).toBe(1);
    expect(api.getTasksByHash(ico)[0].status).toBe('skipped');
    expect(api.getTasksByHash(png)[0].status).toBe('pending');
  });

  it('keeps ineligible tasks skipped during a full rescan', async () => {
    const ico = save('image/x-icon', 'icon');
    const png = save('image/png', 'png');
    api.recordSkippedTask({ taskType: 'classify', hash: ico, error: 'unsupported' });
    api.enqueueTask({ taskType: 'classify', hash: png });

    const result = (await handler('requeueAll', { taskType: 'classify' })) as { count: number };

    expect(result.count).toBe(1);
    expect(api.getTasksByHash(ico)[0].status).toBe('skipped');
    expect(api.getTasksByHash(png)[0].status).toBe('pending');
  });
});
