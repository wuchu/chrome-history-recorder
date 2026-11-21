/**
 * App RPC handler tests for per-task scheduling controls.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
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
import { Scheduler, type SchedulerStatus } from '../src/scheduler';
import { createAppExternalHandler } from '../src/handlers';
import type { MediaArchiveStatus } from '../src/media-archive';
import type { WorkspaceInfo, WorkspaceUpdateResult } from '../src/workspace-config';

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

describe('App handlers: task scheduling', () => {
  let workspacePath: string;
  let db: SQLiteDatabase;
  let api: VFSAPI;
  let store: ConfigStore;
  let events: EventBus;
  let scheduler: Scheduler;
  let handler: ReturnType<typeof createAppExternalHandler>;
  let archiveConcurrency: number;

  beforeEach(() => {
    workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'app-handlers-'));
    ensureWorkspace(workspacePath);
    db = new SQLiteDatabase(workspacePath);
    api = new VFSAPI(
      db,
      new BlobStorage(workspacePath),
      new ThumbnailStorage(workspacePath),
      workspacePath
    );
    store = new ConfigStore(workspacePath);
    store.load();
    events = new EventBus();
    scheduler = new Scheduler({ api, ai: createFakeAi(), config: store, events });
    archiveConcurrency = 1;

    const archiveStatus = (): MediaArchiveStatus => ({
      enabled: false,
      targetPath: '',
      intervalMinutes: 5,
      concurrency: archiveConcurrency,
      running: false,
      pendingCount: 0,
      failedCount: 0,
    });

    handler = createAppExternalHandler({
      api,
      ai: createFakeAi(),
      store,
      scheduler,
      events,
      workspace: {
        getInfo: () =>
          ({
            path: workspacePath,
            defaultPath: workspacePath,
            source: 'default',
          }) as WorkspaceInfo,
        setPath: () => ({ pendingPath: workspacePath }) as WorkspaceUpdateResult,
      },
      mediaArchive: {
        getStatus: archiveStatus,
        updateConfig: (update) => {
          archiveConcurrency = update.concurrency ?? archiveConcurrency;
          return archiveStatus();
        },
        runNow: archiveStatus,
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
    fs.rmSync(workspacePath, { recursive: true, force: true });
  });

  it('pauses and resumes AI task types independently', async () => {
    const paused = (await handler('setTaskPaused', {
      taskType: 'classify',
      paused: true,
    })) as SchedulerStatus;

    expect(paused.byType.classify.state).toBe('paused');
    expect(store.get().classifyPaused).toBe(true);
    expect(store.get().renamePaused).toBe(true);

    const resumed = (await handler('setTaskPaused', {
      taskType: 'rename',
      paused: false,
    })) as SchedulerStatus;

    expect(resumed.byType.rename.state).toBe('running');
    expect(store.get().renamePaused).toBe(false);
    expect(store.get().classifyPaused).toBe(true);
  });

  it('keeps classification aliases applying to both AI types', async () => {
    await handler('startClassification', {});
    expect(store.get().classifyPaused).toBe(false);
    expect(store.get().renamePaused).toBe(false);

    const paused = (await handler('pauseClassification', {})) as SchedulerStatus;
    expect(paused.byType.classify.state).toBe('paused');
    expect(paused.byType.rename.state).toBe('paused');
  });

  it('rejects unsupported task types', async () => {
    await expect(handler('setTaskPaused', { taskType: 'archive', paused: true })).resolves.toEqual({
      success: false,
      error: 'Unsupported task type',
    });
  });

  it('forwards archive concurrency updates', async () => {
    const status = (await handler('updateMediaArchiveConfig', {
      concurrency: 4,
    })) as MediaArchiveStatus;

    expect(status.concurrency).toBe(4);
  });

  it('migrates legacy extension configuration through the RPC path', async () => {
    const result = (await handler('migrateConfig', {
      config: {
        classificationConcurrency: 3,
        classificationPaused: false,
      },
    })) as { imported: boolean };

    expect(result.imported).toBe(true);
    expect(store.get().ollamaMaxConcurrency).toBe(3);
    expect(store.get().classifyPaused).toBe(false);
    expect(store.get().renamePaused).toBe(false);
  });
});
