import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { SQLiteDatabase, ensureWorkspace, type FileMetadata } from '../src/sqlite';

function baseFile(
  overrides: Partial<FileMetadata> & { hash: string }
): Omit<FileMetadata, 'created_at' | 'updated_at' | 'source_domain'> {
  return {
    hash: overrides.hash,
    blob_ext: overrides.blob_ext ?? 'jpg',
    mime_type: overrides.mime_type ?? 'image/jpeg',
    size: overrides.size ?? 1000,
    source_url: overrides.source_url ?? null,
    captured_at: overrides.captured_at ?? '2026-01-01T00:00:00.000Z',
    category: overrides.category ?? 'uncategorized',
    ai_filename: overrides.ai_filename ?? null,
    tags: overrides.tags ?? null,
    confidence: overrides.confidence ?? 0,
    classified_at: overrides.classified_at ?? null,
    model_used: overrides.model_used ?? null,
    is_starred: overrides.is_starred ?? 0,
    user_notes: overrides.user_notes ?? null,
    is_deleted: overrides.is_deleted ?? 0,
    deleted_at: overrides.deleted_at ?? null,
  };
}

describe('media query, search, and curation', () => {
  let db: SQLiteDatabase;
  let workspace: string;

  beforeEach(() => {
    workspace = path.join(
      os.tmpdir(),
      `vfs-media-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    ensureWorkspace(workspace);
    db = new SQLiteDatabase(workspace);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  function seed() {
    db.insertFile(
      baseFile({
        hash: 'hash-beach',
        ai_filename: 'sunset beach',
        tags: JSON.stringify(['system:image', 'cat', 'dog']),
        source_url: 'https://www.example.com/a/beach.jpg',
        user_notes: 'quiet beach at dusk',
        size: 300,
        captured_at: '2026-01-01T00:00:00.000Z',
      })
    );
    db.insertFile(
      baseFile({
        hash: 'hash-cat',
        ai_filename: 'sleeping cat',
        tags: JSON.stringify(['system:image', 'cat']),
        source_url: 'https://blog.example.com/cat.jpg',
        size: 500,
        captured_at: '2026-01-02T00:00:00.000Z',
      })
    );
    db.insertFile(
      baseFile({
        hash: 'hash-video',
        blob_ext: 'mp4',
        mime_type: 'video/mp4',
        ai_filename: '海边日落',
        tags: JSON.stringify(['system:video', 'travel']),
        source_url: 'https://videos.example.org/sunset.mp4',
        size: 900,
        captured_at: '2026-01-03T00:00:00.000Z',
      })
    );
  }

  it('searches English substrings and Chinese text', () => {
    seed();

    expect(db.listFiles({ q: 'beach' }).items.map((item) => item.hash)).toEqual(['hash-beach']);
    expect(db.listFiles({ q: 'sleeping' }).items.map((item) => item.hash)).toEqual(['hash-cat']);
    expect(db.listFiles({ q: '日落' }).items.map((item) => item.hash)).toEqual(['hash-video']);
  });

  it('combines structured filters', () => {
    seed();

    expect(db.listFiles({ mimeType: 'video' }).items.map((item) => item.hash)).toEqual([
      'hash-video',
    ]);
    expect(db.listFiles({ sourceDomain: 'example.com' }).items.map((item) => item.hash)).toEqual([
      'hash-beach',
    ]);
    expect(
      db.listFiles({ sourceDomain: 'blog.example.com' }).items.map((item) => item.hash)
    ).toEqual(['hash-cat']);
    expect(
      db.listFiles({ capturedFrom: '2026-01-02T00:00:00.000Z' }).items.map((item) => item.hash)
    ).toEqual(['hash-video', 'hash-cat']);
  });

  it('supports multi-tag AND and OR filters', () => {
    seed();

    expect(
      db.listFiles({ tags: ['cat', 'dog'], tagMode: 'and' }).items.map((item) => item.hash)
    ).toEqual(['hash-beach']);
    expect(
      db.listFiles({ tags: ['cat', 'travel'], tagMode: 'or' }).items.map((item) => item.hash)
    ).toEqual(['hash-video', 'hash-cat', 'hash-beach']);
    expect(
      db.listFiles({ tags: ['system:image'], tagMode: 'or' }).items.map((item) => item.hash)
    ).toEqual(['hash-cat', 'hash-beach']);
  });

  it('sorts by size and AI filename with hash as a tiebreaker', () => {
    seed();

    expect(db.listFiles({ orderBy: 'size', order: 'desc' }).items[0].hash).toBe('hash-video');
    expect(db.listFiles({ orderBy: 'size', order: 'asc' }).items[0].hash).toBe('hash-beach');
    expect(
      db.listFiles({ orderBy: 'ai_filename', order: 'asc' }).items.map((item) => item.hash)
    ).toEqual(['hash-cat', 'hash-beach', 'hash-video']);
  });

  it('paginates with a stable cursor', () => {
    seed();

    const first = db.listFiles({ limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toBeTruthy();

    const second = db.listFiles({ limit: 2, cursor: first.nextCursor });
    const hashes = [...first.items, ...second.items].map((item) => item.hash);
    expect(new Set(hashes).size).toBe(3);
    expect(second.hasMore).toBe(false);
  });

  it('validates orderBy, limit, and offset', () => {
    seed();

    expect(() => db.listFiles({ orderBy: 'not_a_column' as never })).toThrow(/orderBy/);
    expect(() => db.listFiles({ offset: -1 })).toThrow(/offset/);
    expect(db.listFiles({ limit: 100000 }).items.length).toBeLessThanOrEqual(500);
  });

  it('lists source domains with counts', () => {
    seed();

    const domains = db.getSourceDomains();
    expect(domains).toContainEqual({ domain: 'example.com', count: 1 });
    expect(domains).toContainEqual({ domain: 'blog.example.com', count: 1 });
    expect(domains).toContainEqual({ domain: 'videos.example.org', count: 1 });
  });

  it('curates star, notes, and tags without dropping system tags', () => {
    seed();

    db.setFileStarred('hash-beach', true);
    let file = db.getFile('hash-beach')!;
    expect(file.is_starred).toBe(1);
    expect(JSON.parse(file.tags!)).toContain('system:starred');
    expect(JSON.parse(file.tags!)).toContain('cat');

    db.updateFileNotes('hash-beach', 'a very quiet beach');
    expect(db.listFiles({ q: 'very quiet' }).items.map((item) => item.hash)).toEqual([
      'hash-beach',
    ]);

    db.addFileTags('hash-beach', ['vacation', 'cat']);
    file = db.getFile('hash-beach')!;
    const tags = JSON.parse(file.tags!) as string[];
    expect(tags).toContain('vacation');
    expect(tags.filter((tag) => tag === 'cat')).toHaveLength(1);
    expect(db.getTagByName('vacation')?.created_by).toBe('user');

    db.removeFileTags('hash-beach', ['cat', 'system:starred']);
    file = db.getFile('hash-beach')!;
    const after = JSON.parse(file.tags!) as string[];
    expect(after).not.toContain('cat');
    expect(after).toContain('system:starred');
    expect(after).toContain('system:image');
  });

  it('rejects reserved user tag names', () => {
    seed();
    expect(() => db.addFileTags('hash-beach', ['system:image'])).toThrow(/Reserved/);
    expect(() => db.addFileTags('hash-beach', ['starred'])).toThrow(/Reserved/);
  });

  it('keeps the search index across reopen', () => {
    seed();
    expect(db.listFiles({ q: 'beach' }).items).toHaveLength(1);

    db.close();
    db = new SQLiteDatabase(workspace);

    expect(db.listFiles({ q: 'beach' }).items).toHaveLength(1);
    expect(db.listFiles({ q: '日落' }).items).toHaveLength(1);
  });

  it('migrates a legacy workspace without source_domain or FTS', () => {
    const legacyWorkspace = path.join(
      os.tmpdir(),
      `vfs-legacy-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    ensureWorkspace(legacyWorkspace);
    const legacy = new Database(path.join(legacyWorkspace, 'vfs.db'));
    legacy.exec(`
      CREATE TABLE files (
        hash TEXT PRIMARY KEY,
        blob_ext TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        source_url TEXT,
        captured_at TEXT NOT NULL,
        category TEXT DEFAULT 'uncategorized',
        ai_filename TEXT,
        tags TEXT,
        confidence REAL DEFAULT 0,
        classified_at TEXT,
        model_used TEXT,
        is_starred INTEGER DEFAULT 0,
        user_notes TEXT,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    legacy
      .prepare(
        `INSERT INTO files (
          hash, blob_ext, mime_type, size, source_url, captured_at, category,
          ai_filename, tags, confidence, classified_at, model_used, is_starred,
          user_notes, is_deleted, deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'legacy-hash',
        'jpg',
        'image/jpeg',
        100,
        'https://www.legacy.example.com/a.jpg',
        '2026-01-01T00:00:00.000Z',
        'uncategorized',
        'legacy photo',
        JSON.stringify(['system:image']),
        0,
        null,
        null,
        0,
        null,
        0,
        null,
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
      );
    legacy.close();

    const migrated = new SQLiteDatabase(legacyWorkspace);
    try {
      expect(migrated.getFile('legacy-hash')?.source_domain).toBe('legacy.example.com');
      expect(migrated.listFiles({ q: 'legacy' }).items).toHaveLength(1);
      expect(migrated.getSourceDomains()).toContainEqual({
        domain: 'legacy.example.com',
        count: 1,
      });
    } finally {
      migrated.close();
      fs.rmSync(legacyWorkspace, { recursive: true, force: true });
    }
  });
});
