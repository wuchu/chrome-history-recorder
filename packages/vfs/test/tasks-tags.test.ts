/**
 * VFS Service - Unified tasks & tag vocabulary tests.
 *
 * Covers typed task enqueue/claim/backoff semantics, the legacy queue
 * migration, and AI tag resolution (aliases, merge, system tag retention).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SQLiteDatabase, ensureWorkspace } from '../src/sqlite';
import type { FileMetadata } from '../src/sqlite';

function makeFile(hash: string, overrides: Partial<FileMetadata> = {}): FileMetadata {
  const now = new Date().toISOString();
  return {
    hash,
    blob_ext: 'jpg',
    mime_type: 'image/jpeg',
    size: 1024,
    source_url: 'https://example.com',
    captured_at: now,
    category: 'uncategorized',
    ai_filename: null,
    tags: null,
    confidence: 0,
    classified_at: null,
    model_used: null,
    is_starred: 0,
    user_notes: null,
    is_deleted: 0,
    deleted_at: null,
    ...overrides,
  } as FileMetadata;
}

describe('SQLiteDatabase tasks and tags', () => {
  let db: SQLiteDatabase;
  let workspace: string;

  beforeEach(() => {
    workspace = path.join(
      os.tmpdir(),
      `vfs-tasks-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    ensureWorkspace(workspace);
    db = new SQLiteDatabase(workspace);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // Database may not have been initialized if a test failed early.
    }
    if (fs.existsSync(workspace)) {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  function insertFile(hash: string, overrides: Partial<FileMetadata> = {}): void {
    db.insertFile(makeFile(hash, overrides));
  }

  describe('typed tasks', () => {
    it('enqueues idempotently per (task_type, hash)', () => {
      insertFile('h1');
      expect(db.enqueueTask({ taskType: 'classify', hash: 'h1' })).toBe(true);
      expect(db.enqueueTask({ taskType: 'classify', hash: 'h1' })).toBe(true);

      expect(db.getTasksByHash('h1')).toHaveLength(1);
      expect(db.getQueueStatus().byType?.classify.total).toBe(1);
    });

    it('does not resurrect a completed task without requeue', () => {
      insertFile('h1');
      db.enqueueTask({ taskType: 'rename', hash: 'h1' });
      db.updateTaskStatus({ taskType: 'rename', hash: 'h1', status: 'completed' });

      db.enqueueTask({ taskType: 'rename', hash: 'h1' });
      const [task] = db.getTasksByHash('h1');
      expect(task.status).toBe('completed');
    });

    it('requeue resets a completed task and its attempts', () => {
      insertFile('h1');
      db.enqueueTask({ taskType: 'classify', hash: 'h1' });
      db.updateTaskStatus({ taskType: 'classify', hash: 'h1', status: 'completed' });

      db.enqueueTask({ taskType: 'classify', hash: 'h1', requeue: true });
      const [task] = db.getTasksByHash('h1');
      expect(task.status).toBe('pending');
      expect(task.attempts).toBe(0);
      expect(task.completed_at).toBeNull();
    });

    it('rejects enqueueing for a missing file', () => {
      expect(db.enqueueTask({ taskType: 'classify', hash: 'missing' })).toBe(false);
    });

    it('claims due tasks atomically, in priority order', () => {
      insertFile('low');
      insertFile('high');
      db.enqueueTask({ taskType: 'classify', hash: 'low', priority: 1 });
      db.enqueueTask({ taskType: 'classify', hash: 'high', priority: 9 });

      const first = db.claimTasks(1);
      expect(first).toHaveLength(1);
      expect(first[0].target_hash).toBe('high');
      expect(first[0].status).toBe('processing');

      // The claimed row is no longer pending, so it cannot be claimed twice.
      expect(db.claimTasks(1)[0]?.target_hash).toBe('low');
      expect(db.claimTasks(1)).toHaveLength(0);
    });

    it('applies backoff then terminal failure after max_attempts', () => {
      insertFile('h1');
      db.enqueueTask({ taskType: 'classify', hash: 'h1', maxAttempts: 2 });
      db.claimTasks(1);

      db.updateTaskStatus({
        taskType: 'classify',
        hash: 'h1',
        status: 'failed',
        error: 'boom',
        retryDelayMs: 60_000,
      });

      let [task] = db.getTasksByHash('h1');
      expect(task.status).toBe('pending');
      expect(task.attempts).toBe(1);
      expect(task.error).toBe('boom');
      expect(task.next_run_at).not.toBeNull();
      // Backoff keeps it out of the claim window.
      expect(db.claimTasks(1)).toHaveLength(0);

      db.updateTaskStatus({
        taskType: 'classify',
        hash: 'h1',
        status: 'failed',
        error: 'boom again',
        retryDelayMs: 0,
      });

      [task] = db.getTasksByHash('h1');
      expect(task.status).toBe('failed');
      expect(task.attempts).toBe(2);
    });

    it('recovers tasks left processing by a terminated worker', () => {
      insertFile('h1');
      db.enqueueTask({ taskType: 'classify', hash: 'h1' });
      db.claimTasks(1);
      expect(db.getTasksByHash('h1')[0].status).toBe('processing');

      expect(db.recoverStaleProcessingTasks()).toBe(1);
      expect(db.getTasksByHash('h1')[0].status).toBe('pending');
    });

    it('reports per-type queue status and supports type-scoped clears', () => {
      insertFile('h1');
      insertFile('h2');
      db.enqueueTask({ taskType: 'classify', hash: 'h1' });
      db.enqueueTask({ taskType: 'rename', hash: 'h1' });
      db.enqueueTask({ taskType: 'rename', hash: 'h2' });

      const status = db.getQueueStatus();
      expect(status.total).toBe(3);
      expect(status.byType?.classify.total).toBe(1);
      expect(status.byType?.rename.total).toBe(2);

      db.clearQueue('rename');
      const after = db.getQueueStatus();
      expect(after.total).toBe(1);
      expect(after.byType?.rename).toBeUndefined();
    });

    it('requeue creates a missing task for an existing file', () => {
      insertFile('legacy');

      expect(db.requeueTask('rename', 'legacy')).toBe(true);
      expect(db.getTasksByHash('legacy')).toMatchObject([
        { task_type: 'rename', status: 'pending' },
      ]);
      expect(db.requeueTask('classify', 'missing')).toBe(false);
    });

    it('full rescan creates missing per-type tasks and resets existing ones', () => {
      insertFile('old');
      insertFile('deleted');
      db.softDeleteFile('deleted');
      db.enqueueTask({ taskType: 'classify', hash: 'old' });
      db.updateTaskStatus({ taskType: 'classify', hash: 'old', status: 'completed' });

      expect(db.requeueAll({ taskType: 'rename' })).toBe(1);
      expect(db.getTasksByHash('old').map((t) => t.task_type)).toEqual(['classify', 'rename']);
      expect(db.getTasksByHash('deleted')).toHaveLength(0);

      // Only the rename task is pending; classify is still completed.
      expect(db.claimTasks(10).map((t) => t.task_type)).toEqual(['rename']);
      expect(db.requeueAll({ taskType: 'classify' })).toBe(1);
      expect(db.claimTasks(10).map((t) => t.task_type)).toEqual(['classify']);
    });

    it('deletes tasks when their file is hard-deleted', () => {
      insertFile('h1');
      db.enqueueTask({ taskType: 'classify', hash: 'h1' });
      db.hardDeleteFile('h1');
      expect(db.getTasksByHash('h1')).toHaveLength(0);
    });
  });

  describe('skipped tasks', () => {
    it('records a terminal skipped row that cannot be claimed', () => {
      insertFile('ico', { mime_type: 'image/x-icon' });

      expect(
        db.recordSkippedTask({
          taskType: 'classify',
          hash: 'ico',
          error: 'unsupported-format',
        })
      ).toBe(true);

      const [task] = db.getTasksByHash('ico');
      expect(task.status).toBe('skipped');
      expect(task.error).toBe('unsupported-format');
      expect(db.claimTasks(10)).toHaveLength(0);
    });

    it('converts pending and failed rows but preserves completed results', () => {
      insertFile('ico', { mime_type: 'image/x-icon' });
      insertFile('done');
      db.enqueueTask({ taskType: 'classify', hash: 'ico' });
      db.enqueueTask({ taskType: 'classify', hash: 'done' });
      db.updateTaskStatus({ taskType: 'classify', hash: 'done', status: 'completed' });

      db.recordSkippedTask({ taskType: 'classify', hash: 'ico', error: 'unsupported' });
      db.recordSkippedTask({ taskType: 'classify', hash: 'done', error: 'unsupported' });

      expect(db.getTasksByHash('ico')[0].status).toBe('skipped');
      expect(db.getTasksByHash('done')[0].status).toBe('completed');
    });

    it('counts skipped tasks in queue status', () => {
      insertFile('ico', { mime_type: 'image/x-icon' });
      db.recordSkippedTask({ taskType: 'classify', hash: 'ico', error: 'unsupported' });
      db.recordSkippedTask({ taskType: 'rename', hash: 'ico', error: 'unsupported' });

      const status = db.getQueueStatus();
      expect(status.skipped).toBe(2);
      expect(status.total).toBe(2);
      expect(status.byType?.classify.skipped).toBe(1);
      expect(status.byType?.rename.skipped).toBe(1);
    });

    it('splits retry-failed into skipped and pending by eligibility', () => {
      insertFile('ico', { mime_type: 'image/x-icon' });
      insertFile('png');
      for (const hash of ['ico', 'png']) {
        db.enqueueTask({ taskType: 'classify', hash, maxAttempts: 1 });
        db.updateTaskStatus({
          taskType: 'classify',
          hash,
          status: 'failed',
          error: 'boom',
          retryDelayMs: 0,
        });
      }

      const reset = db.retryFailedTasks({ ineligibleMimeTypes: ['image/x-icon'] });
      expect(reset).toBe(1);
      expect(db.getTasksByHash('ico')[0].status).toBe('skipped');
      expect(db.getTasksByHash('png')[0].status).toBe('pending');
    });

    it('full rescan never resets ineligible tasks to pending', () => {
      insertFile('ico', { mime_type: 'image/x-icon' });
      insertFile('png');
      db.recordSkippedTask({ taskType: 'classify', hash: 'ico', error: 'unsupported' });
      db.enqueueTask({ taskType: 'classify', hash: 'png' });

      const count = db.requeueAll({
        taskType: 'classify',
        ineligibleMimeTypes: ['image/x-icon'],
      });

      expect(count).toBe(1);
      expect(db.getTasksByHash('ico')[0].status).toBe('skipped');
      expect(db.getTasksByHash('png')[0].status).toBe('pending');
    });

    it('startup reconciliation converts persisted ineligible tasks', () => {
      insertFile('ico', { mime_type: 'image/x-icon' });
      insertFile('png');
      db.enqueueTask({ taskType: 'classify', hash: 'ico' });
      db.enqueueTask({ taskType: 'classify', hash: 'png' });

      const converted = db.skipIneligibleTasks({
        ineligibleMimeTypes: ['image/x-icon'],
        error: 'unsupported',
      });

      expect(converted).toBe(1);
      expect(db.getTasksByHash('ico')[0].status).toBe('skipped');
      expect(db.getTasksByHash('png')[0].status).toBe('pending');
    });
  });

  describe('legacy classify_queue migration', () => {
    it('copies rows into tasks and drops the old table', () => {
      insertFile('h1');
      insertFile('h2');
      db.close();

      const rawDbPath = path.join(workspace, 'vfs.db');
      const raw = new Database(rawDbPath);
      raw.exec('DROP TABLE tasks');
      raw.exec(`
        CREATE TABLE classify_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hash TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          priority INTEGER NOT NULL DEFAULT 5,
          retries INTEGER NOT NULL DEFAULT 0,
          added_at TEXT NOT NULL,
          started_at TEXT,
          completed_at TEXT,
          error TEXT
        )
      `);
      raw
        .prepare(
          `INSERT INTO classify_queue (hash, status, priority, retries, added_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run('h1', 'failed', 7, 2, new Date().toISOString());
      // Orphan row (file no longer exists) must be skipped, not fail the migration.
      raw
        .prepare(
          `INSERT INTO classify_queue (hash, status, priority, retries, added_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run('gone', 'pending', 5, 0, new Date().toISOString());
      raw.close();

      db = new SQLiteDatabase(workspace);

      const migrated = db.getTasksByHash('h1');
      expect(migrated).toHaveLength(1);
      expect(migrated[0]).toMatchObject({
        task_type: 'classify',
        status: 'failed',
        priority: 7,
        attempts: 2,
      });
      expect(db.getTasksByHash('gone')).toHaveLength(0);

      const checkDb = new Database(rawDbPath);
      const tables = checkDb
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'classify_queue'")
        .all();
      checkDb.close();
      expect(tables).toHaveLength(0);
    });
  });

  describe('tag vocabulary', () => {
    it('creates tags and aliases, preserving system tags and category', () => {
      insertFile('h1', { tags: JSON.stringify(['system:image', 'old']), category: 'legacy' });

      const result = db.applyClassification({
        hash: 'h1',
        tags: ['Cat', '  Cute  Cat ', 'NEW:sofa'],
        aliases: { kitten: 'cat' },
        confidence: 0.9,
        modelUsed: 'test-model',
      });

      expect(result.tags).toEqual(['cat', 'cute cat', 'sofa']);
      const file = db.getFile('h1');
      expect(JSON.parse(file!.tags!)).toEqual(['system:image', 'cat', 'cute cat', 'sofa']);
      expect(file!.category).toBe('legacy');
      expect(file!.confidence).toBe(0.9);
      expect(file!.model_used).toBe('test-model');
      expect(file!.classified_at).not.toBeNull();

      expect(db.resolveTagName('Kitten')).toBe('cat');
      expect(db.resolveTagName('missing')).toBeNull();
      expect(db.getTagByName('cat')?.created_by).toBe('ai');
    });

    it('replaces content tags on re-classification but keeps system tags', () => {
      insertFile('h1');
      db.applyClassification({ hash: 'h1', tags: ['cat', 'sofa'] });
      db.updateMetadata('h1', { tags: ['system:starred', 'cat', 'sofa'] });

      db.applyClassification({ hash: 'h1', tags: ['dog'] });
      const file = db.getFile('h1');
      expect(JSON.parse(file!.tags!)).toEqual(['system:starred', 'dog']);
    });

    it('renames a tag across files and keeps the old name as an alias', () => {
      insertFile('h1');
      db.applyClassification({ hash: 'h1', tags: ['kitten'] });
      const tag = db.getTagByName('kitten')!;

      const renamed = db.renameTag({ id: tag.id, name: 'Cat', label: '🐱 猫咪' });
      expect(renamed.name).toBe('cat');
      expect(renamed.label).toBe('🐱 猫咪');
      expect(JSON.parse(db.getFile('h1')!.tags!)).toEqual(['cat']);
      expect(db.resolveTagName('kitten')).toBe('cat');
    });

    it('merges tags, moving files and aliases and recomputing usage', () => {
      insertFile('h1');
      insertFile('h2');
      db.applyClassification({ hash: 'h1', tags: ['kitten'], aliases: { kitty: 'kitten' } });
      db.applyClassification({ hash: 'h2', tags: ['cat'] });
      const source = db.getTagByName('kitten')!;
      const target = db.getTagByName('cat')!;

      const merged = db.mergeTags(source.id, target.id);
      expect(merged.name).toBe('cat');
      expect(db.getTag(source.id)).toBeNull();
      expect(JSON.parse(db.getFile('h1')!.tags!)).toEqual(['cat']);
      expect(db.resolveTagName('kitty')).toBe('cat');
      expect(db.getTagByName('cat')!.usage_count).toBe(2);
    });

    it('deletes a tag and strips it from files', () => {
      insertFile('h1');
      db.applyClassification({ hash: 'h1', tags: ['cat', 'sofa'] });
      const tag = db.getTagByName('cat')!;

      expect(db.deleteTag(tag.id)).toBe(true);
      expect(db.getTagByName('cat')).toBeNull();
      expect(JSON.parse(db.getFile('h1')!.tags!)).toEqual(['sofa']);
    });

    it('orders pinned tags first and exposes the prompt vocabulary', () => {
      insertFile('h1');
      insertFile('h2');
      db.applyClassification({ hash: 'h1', tags: ['cat', 'dog'] });
      db.applyClassification({ hash: 'h2', tags: ['cat'] });
      const dog = db.getTagByName('dog')!;

      expect(db.listTags()[0].name).toBe('cat');
      db.setTagPinned(dog.id, true);

      expect(db.listTags()[0].name).toBe('dog');
      expect(db.listTags({ pinnedOnly: true })).toHaveLength(1);
      expect(db.getTagVocabulary(1)).toEqual(['dog']);
    });
  });

  describe('incremental tag usage', () => {
    function usage(): Record<string, number> {
      return Object.fromEntries(
        db.listTags({ limit: 500 }).map((tag) => [tag.name, tag.usage_count])
      );
    }

    it('tracks classification changes', () => {
      insertFile('h1');
      insertFile('h2');
      db.applyClassification({ hash: 'h1', tags: ['cat', 'dog'] });
      db.applyClassification({ hash: 'h2', tags: ['cat'] });
      expect(usage()).toMatchObject({ cat: 2, dog: 1 });

      db.applyClassification({ hash: 'h1', tags: ['cat', 'bird'] });
      expect(usage()).toMatchObject({ cat: 2, dog: 0, bird: 1 });
      expect(db.getTagCounts()).toMatchObject({ cat: 2, bird: 1, all: 2 });
    });

    it('tracks trash, restore, and permanent delete', () => {
      insertFile('h1');
      insertFile('h2');
      db.applyClassification({ hash: 'h1', tags: ['cat', 'bird'] });
      db.applyClassification({ hash: 'h2', tags: ['cat'] });
      expect(usage()).toMatchObject({ cat: 2, bird: 1 });

      db.softDeleteFile('h1');
      expect(usage()).toMatchObject({ cat: 1, bird: 0 });

      db.restoreFile('h1');
      expect(usage()).toMatchObject({ cat: 2, bird: 1 });

      db.softDeleteFile('h1');
      expect(usage()).toMatchObject({ cat: 1, bird: 0 });
      db.hardDeleteFile('h1');
      expect(usage()).toMatchObject({ cat: 1, bird: 0 });

      db.softDeleteFile('h2');
      expect(usage()).toMatchObject({ cat: 0 });
      expect(db.restoreAllFiles()).toBe(1);
      expect(usage()).toMatchObject({ cat: 1 });
    });

    it('tracks user tag add and remove without double counting', () => {
      insertFile('h1');
      db.addFileTags('h1', ['cat', 'dog']);
      expect(usage()).toMatchObject({ cat: 1, dog: 1 });

      db.addFileTags('h1', ['dog']);
      expect(usage()).toMatchObject({ cat: 1, dog: 1 });

      db.removeFileTags('h1', ['cat']);
      expect(usage()).toMatchObject({ cat: 0, dog: 1 });
    });

    it('matches a full recompute after mixed operations', () => {
      insertFile('h1');
      insertFile('h2');
      insertFile('h3');
      db.applyClassification({ hash: 'h1', tags: ['cat', 'dog'] });
      db.applyClassification({ hash: 'h2', tags: ['cat'] });
      db.applyClassification({ hash: 'h3', tags: ['bird'] });
      db.addFileTags('h2', ['sofa']);
      db.removeFileTags('h3', ['bird']);
      db.softDeleteFile('h1');
      db.softDeleteFile('h2');
      db.restoreFile('h2');
      db.hardDeleteFile('h3');

      const incremental = usage();
      db.recomputeTagUsage();
      expect(usage()).toEqual(incremental);
    });
  });
});
