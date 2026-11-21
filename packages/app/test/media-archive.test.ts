import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BlobStorage, SQLiteDatabase, ThumbnailStorage, VFSAPI, ensureWorkspace } from 'vfs';
import { ConfigStore } from '../src/config-store';
import { EventBus } from '../src/event-bus';
import {
  ARCHIVE_TASK_TYPE,
  MEDIA_ARCHIVE_STATE_FILE,
  MediaArchiveTargetError,
  MediaArchiveWorker,
  readMediaArchiveState,
  validateMediaArchiveTarget,
  writeMediaArchiveState,
  type MediaArchiveState,
} from '../src/media-archive';

const START = new Date('2026-01-01T00:00:00.000Z').getTime();

describe('media archive tasks', () => {
  let workspace: string;
  let target: string;
  let db: SQLiteDatabase;
  let api: VFSAPI;
  let store: ConfigStore;
  let events: EventBus;
  let worker: MediaArchiveWorker | null;

  function enableArchive(overrides: { targetPath?: string } = {}): void {
    store.update({
      mediaArchiveEnabled: true,
      mediaArchiveTargetPath: overrides.targetPath ?? target,
    });
  }

  function saveImage(content: string, mimeType = 'image/jpeg'): string {
    return api.saveFile({ buffer: Buffer.from(content), mimeType }).hash;
  }

  function archiveSummary() {
    return (
      api.getQueueStatus().byType[ARCHIVE_TASK_TYPE] ?? {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0,
      }
    );
  }

  function archivedFiles(dir = target): string[] {
    return fs.readdirSync(dir).filter((name) => !name.endsWith('.part'));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);

    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'media-archive-ws-'));
    target = fs.mkdtempSync(path.join(os.tmpdir(), 'media-archive-target-'));
    ensureWorkspace(workspace);

    db = new SQLiteDatabase(workspace);
    api = new VFSAPI(db, new BlobStorage(workspace), new ThumbnailStorage(workspace), workspace);
    store = new ConfigStore(workspace);
    store.load();
    events = new EventBus();
    worker = null;
  });

  afterEach(() => {
    worker?.stop();
    try {
      db.close();
    } catch {
      // Ignore close errors.
    }
    vi.useRealTimers();
    for (const dir of [workspace, target]) {
      try {
        fs.chmodSync(dir, 0o755);
      } catch {
        // Ignore.
      }
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('archives new files as archive tasks using <hash>.<ext>', async () => {
    vi.setSystemTime(START + 1000);
    enableArchive();
    worker = new MediaArchiveWorker({ api, store, events, workspacePath: workspace });

    const hash = saveImage('hello archive');
    await worker.runOnce();

    expect(archivedFiles()).toEqual([`${hash}.jpg`]);
    expect(fs.statSync(path.join(target, `${hash}.jpg`)).size).toBe(
      Buffer.byteLength('hello archive')
    );
    expect(archiveSummary().completed).toBe(1);
    expect(worker.getStatus().pendingCount).toBe(0);
  });

  it('does not enqueue files created before activation', async () => {
    const before = saveImage('before activation');

    vi.setSystemTime(START + 60_000);
    enableArchive();
    worker = new MediaArchiveWorker({ api, store, events, workspacePath: workspace });
    await worker.runOnce();

    vi.setSystemTime(START + 120_000);
    const after = saveImage('after activation');
    await worker.runOnce();

    expect(archivedFiles()).toEqual([`${after}.jpg`]);
    expect(api.getTasksByHash(before)).toEqual([]);
  });

  it('skips files that are already archived', async () => {
    vi.setSystemTime(START + 1000);
    enableArchive();
    const copyFile = vi.fn((source: string, destination: string) =>
      fs.promises.copyFile(source, destination)
    );
    worker = new MediaArchiveWorker({ api, store, events, workspacePath: workspace, copyFile });

    saveImage('only once');
    await worker.runOnce();
    await worker.runOnce();

    expect(copyFile).toHaveBeenCalledTimes(1);
  });

  it('keeps failed tasks pending and retries them after backoff', async () => {
    vi.setSystemTime(START + 1000);
    enableArchive();

    let failuresRemaining = 1;
    const copyFile = async (source: string, destination: string) => {
      if (failuresRemaining > 0) {
        failuresRemaining -= 1;
        fs.writeFileSync(destination, 'partial');
        throw new Error('network hiccup');
      }
      await fs.promises.copyFile(source, destination);
    };

    worker = new MediaArchiveWorker({
      api,
      store,
      events,
      workspacePath: workspace,
      copyFile,
      retryBaseDelayMs: 60_000,
    });
    const hash = saveImage('retry me');

    await worker.runOnce();

    expect(archivedFiles()).toEqual([]);
    expect(archiveSummary().pending).toBe(1);
    expect(archiveSummary().failed).toBe(0);
    const task = api.getTasksByHash(hash).find((row) => row.task_type === ARCHIVE_TASK_TYPE);
    expect(task?.attempts).toBe(1);
    expect(task?.status).toBe('pending');
    expect(fs.existsSync(path.join(target, `.${hash}.jpg.part`))).toBe(false);

    vi.setSystemTime(START + 10 * 60_000);
    await worker.runOnce();

    expect(archivedFiles()).toEqual([`${hash}.jpg`]);
    expect(archiveSummary().completed).toBe(1);
  });

  it('does not create a missing target and leaves tasks pending', async () => {
    vi.setSystemTime(START + 1000);
    enableArchive();
    worker = new MediaArchiveWorker({ api, store, events, workspacePath: workspace });

    const hash = saveImage('pending task');
    worker.enqueue(hash);
    expect(archiveSummary().pending).toBe(1);

    fs.rmSync(target, { recursive: true, force: true });
    await worker.runOnce();

    expect(worker.getStatus().lastError).toContain('不存在');
    expect(fs.existsSync(target)).toBe(false);
    expect(archiveSummary().pending).toBe(1);
  });

  it('completes tasks whose source was permanently deleted before processing', async () => {
    vi.setSystemTime(START + 1000);
    enableArchive();
    worker = new MediaArchiveWorker({ api, store, events, workspacePath: workspace });

    const hash = saveImage('deleted later');
    worker.enqueue(hash);
    await api.purgeFile({ hash });

    await worker.runOnce();

    expect(archivedFiles()).toEqual([]);
    const task = api.getTasksByHash(hash).find((row) => row.task_type === ARCHIVE_TASK_TYPE);
    expect(task).toBeUndefined();
  });

  it('suspends archive tasks while the source is in the trash', async () => {
    vi.setSystemTime(START + 1000);
    enableArchive();
    worker = new MediaArchiveWorker({ api, store, events, workspacePath: workspace });

    const hash = saveImage('trashed later');
    worker.enqueue(hash);
    api.trashFile({ hash });

    await worker.runOnce();

    expect(archivedFiles()).toEqual([]);
    const task = api.getTasksByHash(hash).find((row) => row.task_type === ARCHIVE_TASK_TYPE);
    expect(task?.status).toBe('pending');
  });

  it('keeps the archived copy while the source is trashed and deletes it on purge', async () => {
    vi.setSystemTime(START + 1000);
    enableArchive();
    worker = new MediaArchiveWorker({ api, store, events, workspacePath: workspace });
    api.setPurgeHook((hash, metadata) => worker?.deleteArchived(hash, metadata.blob_ext));

    const hash = saveImage('archive then purge');
    worker.enqueue(hash);
    await worker.runOnce();
    expect(archivedFiles()).toEqual([`${hash}.jpg`]);

    api.trashFile({ hash });
    expect(archivedFiles()).toEqual([`${hash}.jpg`]);

    await api.purgeFile({ hash });
    expect(archivedFiles()).toEqual([]);
  });

  it('removes a copy that finishes after the source is permanently deleted', async () => {
    vi.setSystemTime(START + 1000);
    enableArchive();
    let purgedHash: string | null = null;
    worker = new MediaArchiveWorker({
      api,
      store,
      events,
      workspacePath: workspace,
      copyFile: async (source, destination) => {
        await fs.promises.copyFile(source, destination);
        if (purgedHash) await api.purgeFile({ hash: purgedHash });
      },
    });

    const hash = saveImage('race purge');
    purgedHash = hash;
    worker.enqueue(hash);
    await worker.runOnce();

    expect(archivedFiles()).toEqual([]);
  });

  it('requeues and backfills since activation when the target changes', async () => {
    vi.setSystemTime(START + 1000);
    enableArchive();
    worker = new MediaArchiveWorker({ api, store, events, workspacePath: workspace });

    const first = saveImage('first');
    await worker.runOnce();

    const secondTarget = fs.mkdtempSync(path.join(os.tmpdir(), 'media-archive-target-b-'));
    try {
      const second = saveImage('second');
      store.update({ mediaArchiveTargetPath: secondTarget });
      vi.setSystemTime(START + 120_000);
      await worker.runOnce();

      expect(fs.readdirSync(secondTarget).sort()).toEqual([`${first}.jpg`, `${second}.jpg`].sort());
      expect(archiveSummary().completed).toBe(2);
    } finally {
      fs.rmSync(secondTarget, { recursive: true, force: true });
    }
  });

  it('enqueues through the ingest helper and reports status events', async () => {
    vi.setSystemTime(START + 1000);
    enableArchive();
    const emitted: string[] = [];
    events.subscribe((event) => emitted.push(event));
    worker = new MediaArchiveWorker({ api, store, events, workspacePath: workspace });

    const hash = saveImage('ingest');
    expect(worker.enqueue(hash)).toBe(true);
    expect(archiveSummary().pending).toBe(1);

    await worker.runOnce();

    const status = worker.getStatus();
    expect(status.enabled).toBe(true);
    expect(status.targetPath).toBe(target);
    expect(status.running).toBe(false);
    expect(status.pendingCount).toBe(0);
    expect(status.failedCount).toBe(0);
    expect(status.lastRunAt).toBeDefined();
    expect(emitted).toContain('media-archive:status');
    expect(emitted).toContain('queue:updated');
  });

  it('does not enqueue when archiving is disabled', () => {
    worker = new MediaArchiveWorker({ api, store, events, workspacePath: workspace });
    const hash = saveImage('disabled');

    expect(worker.enqueue(hash)).toBe(false);
    expect(api.getTasksByHash(hash)).toEqual([]);
  });
});

describe('media archive target validation', () => {
  let workspace: string;
  let tempDir: string;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'media-archive-ws-'));
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-archive-target-'));
  });

  afterEach(() => {
    for (const dir of [workspace, tempDir]) {
      try {
        fs.chmodSync(dir, 0o755);
      } catch {
        // Ignore.
      }
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects relative paths', () => {
    expect(() => validateMediaArchiveTarget('relative/path')).toThrow(MediaArchiveTargetError);
  });

  it('rejects missing paths', () => {
    expect(() =>
      validateMediaArchiveTarget(path.join(tempDir, 'missing'), { workspacePath: workspace })
    ).toThrow(/不存在/);
  });

  it('rejects files', () => {
    const file = path.join(tempDir, 'file.txt');
    fs.writeFileSync(file, 'x');
    expect(() => validateMediaArchiveTarget(file)).toThrow(/不是目录/);
  });

  it('rejects paths inside the workspace', () => {
    const inside = path.join(workspace, 'archive');
    fs.mkdirSync(inside);
    expect(() => validateMediaArchiveTarget(inside, { workspacePath: workspace })).toThrow(
      /工作区内部/
    );
  });

  it('rejects the home directory', () => {
    expect(() => validateMediaArchiveTarget(os.homedir())).toThrow(/主目录/);
  });

  it('rejects read-only directories', () => {
    fs.chmodSync(tempDir, 0o555);
    expect(() => validateMediaArchiveTarget(tempDir)).toThrow(/不可写/);
  });

  it('rejects an unmounted macOS volume', () => {
    expect(() =>
      validateMediaArchiveTarget('/Volumes/__missing_volume__/archive', { platform: 'darwin' })
    ).toThrow(/未挂载/);
  });

  it('accepts an existing writable directory', () => {
    expect(validateMediaArchiveTarget(tempDir)).toBe(path.resolve(tempDir));
  });
});

describe('media archive state persistence', () => {
  it('round-trips state', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-archive-state-'));
    const statePath = path.join(dir, MEDIA_ARCHIVE_STATE_FILE);
    const state: MediaArchiveState = {
      version: 1,
      activatedAt: '2026-01-01T00:00:00.000Z',
      targetPath: '/Volumes/archive',
      cursor: { createdAt: '2026-01-02T00:00:00.000Z', hash: 'abc' },
      requeuePending: true,
    };

    try {
      writeMediaArchiveState(statePath, state);
      expect(readMediaArchiveState(statePath)).toEqual(state);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to an empty state when the file is corrupt', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-archive-state-'));
    const statePath = path.join(dir, MEDIA_ARCHIVE_STATE_FILE);
    fs.writeFileSync(statePath, '{ not json');

    try {
      const state = readMediaArchiveState(statePath);
      expect(state.activatedAt).toBeNull();
      expect(state.cursor).toEqual({ createdAt: '', hash: '' });
      expect(state.requeuePending).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps valid fields while dropping malformed ones', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-archive-state-'));
    const statePath = path.join(dir, MEDIA_ARCHIVE_STATE_FILE);
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        activatedAt: '2026-01-01T00:00:00.000Z',
        cursor: { createdAt: '2026-01-02T00:00:00.000Z' },
        requeuePending: 'yes',
      })
    );

    try {
      const state = readMediaArchiveState(statePath);
      expect(state.activatedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(state.cursor).toEqual({ createdAt: '2026-01-02T00:00:00.000Z', hash: '' });
      expect(state.requeuePending).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
