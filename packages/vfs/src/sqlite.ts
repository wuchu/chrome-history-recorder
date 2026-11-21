/**
 * VFS Service - SQLite Database Module
 *
 * Manages the SQLite index for file metadata and classification queue.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const MAX_TAG_NAME_LENGTH = 40;
const SKIPPED_MEDIA_ERROR = 'Media format is not supported by the AI vision pipeline';

/**
 * Normalize a tag candidate into a canonical vocabulary key.
 * Lowercases, strips a leading `NEW:` marker, collapses whitespace and
 * truncates overly long names.
 */
export function normalizeTagName(raw: string): string {
  return raw
    .trim()
    .replace(/^new\s*[:：]\s*/i, '')
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, MAX_TAG_NAME_LENGTH);
}

function parseTagList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string')
      : [];
  } catch {
    return [];
  }
}

/**
 * Normalize a source URL into a hostname used for site filtering. The `www.`
 * prefix is removed so `www.example.com` and `example.com` group together.
 */
function extractSourceDomain(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl) return null;
  try {
    const host = new URL(sourceUrl).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}

function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

const MAX_PAGE_SIZE = 500;
const SEARCH_SCHEMA_VERSION = 1;
const RESERVED_TAG_NAMES = new Set(['image', 'video', 'starred', 'uncategorized']);

// SQLite schema constants
const FILES_TABLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS files (
    -- Immutable (capture-time)
    hash            TEXT PRIMARY KEY,
    blob_ext        TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    size            INTEGER NOT NULL,
    source_url      TEXT,
    source_domain   TEXT,
    captured_at     TEXT NOT NULL,

    -- Mutable (AI classification)
    category        TEXT DEFAULT 'uncategorized',
    ai_filename     TEXT,
    tags            TEXT,
    confidence      REAL DEFAULT 0,
    classified_at   TEXT,
    model_used      TEXT,

    -- Mutable (user)
    is_starred      INTEGER DEFAULT 0,
    user_notes      TEXT,
    -- Trash state: is_deleted = 1 means "in the recycle bin". Together with
    -- deleted_at it is only written by the trash/restore operations.
    is_deleted      INTEGER DEFAULT 0,
    deleted_at      TEXT,

    -- Metadata
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_category ON files(category) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_files_trash ON files(deleted_at) WHERE is_deleted = 1;
CREATE INDEX IF NOT EXISTS idx_files_captured_at ON files(captured_at);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_files_classified ON files(classified_at) WHERE classified_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_starred ON files(is_starred) WHERE is_starred = 1;
`;

const TASKS_TABLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type       TEXT NOT NULL,
    target_hash     TEXT NOT NULL REFERENCES files(hash) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending',
    priority        INTEGER NOT NULL DEFAULT 5,
    attempts        INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 3,
    next_run_at     TEXT,
    started_at      TEXT,
    completed_at    TEXT,
    error           TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    UNIQUE(task_type, target_hash)
);

CREATE INDEX IF NOT EXISTS idx_tasks_claim ON tasks(status, next_run_at, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_hash ON tasks(target_hash);
`;

const TAGS_TABLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS tags (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    label           TEXT,
    usage_count     INTEGER NOT NULL DEFAULT 0,
    created_by      TEXT NOT NULL DEFAULT 'ai',
    is_pinned       INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tags_usage ON tags(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_tags_pinned ON tags(is_pinned) WHERE is_pinned = 1;

CREATE TABLE IF NOT EXISTS tag_aliases (
    alias           TEXT PRIMARY KEY,
    tag_id          INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tag_aliases_tag ON tag_aliases(tag_id);
`;

/**
 * File metadata type
 */
export interface FileMetadata {
  hash: string;
  blob_ext: string;
  mime_type: string;
  size: number;
  source_url: string | null;
  /** Normalized hostname derived from `source_url`. */
  source_domain: string | null;
  captured_at: string;
  category: string;
  ai_filename: string | null;
  tags: string | null; // JSON array
  confidence: number;
  classified_at: string | null;
  model_used: string | null;
  is_starred: number;
  user_notes: string | null;
  /** 1 = in the recycle bin (still recoverable). */
  is_deleted: number;
  /** When the file entered the recycle bin; null for active files. */
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Classification queue item type (legacy shape, backed by `tasks`).
 */
export interface QueueItem {
  id: number;
  hash: string;
  status: TaskStatus;
  priority: number;
  added_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  retries: number;
}

/**
 * Task types supported by the unified engine. Extensible by design.
 */
export type TaskType = 'classify' | 'rename' | (string & {});

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface TaskItem {
  id: number;
  task_type: TaskType;
  target_hash: string;
  status: TaskStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  next_run_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskStatusSummary {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  skipped: number;
  total: number;
}

export interface QueueStatus extends TaskStatusSummary {
  byType: Record<string, TaskStatusSummary>;
}

export interface EnqueueTaskParams {
  taskType: TaskType;
  hash: string;
  priority?: number;
  maxAttempts?: number;
  /**
   * When true an existing task row is reset to pending. When false (default)
   * enqueueing is idempotent and never resurrects a completed/failed task.
   */
  requeue?: boolean;
}

export interface UpdateTaskStatusParams {
  taskType: TaskType;
  hash: string;
  status: TaskStatus;
  error?: string;
  /** Delay before a failed task becomes claimable again. */
  retryDelayMs?: number;
}

export interface RetryFailedParams {
  taskType?: TaskType;
  /**
   * Media MIME types the AI pipeline cannot process. Failed tasks for these
   * types become skipped instead of pending.
   */
  ineligibleMimeTypes?: string[];
  /** Reason recorded when a task is skipped for ineligible media. */
  skipError?: string;
}

export interface RequeueAllParams {
  taskType?: TaskType;
  ineligibleMimeTypes?: string[];
  skipError?: string;
}

export interface RecordSkippedTaskParams {
  taskType: TaskType;
  hash: string;
  error: string;
  priority?: number;
  maxAttempts?: number;
}

export interface SkipIneligibleTasksParams {
  ineligibleMimeTypes: string[];
  error: string;
  taskTypes?: TaskType[];
}

export interface TagRecord {
  id: number;
  name: string;
  label: string | null;
  usage_count: number;
  created_by: 'ai' | 'user' | string;
  is_pinned: number;
  created_at: string;
  updated_at: string;
}

export interface ApplyClassificationParams {
  hash: string;
  tags: string[];
  aliases?: Record<string, string>;
  confidence?: number;
  modelUsed?: string;
  classifiedAt?: string;
}

/**
 * Supported sort fields for media queries.
 */
export type MediaSortField =
  | 'captured_at'
  | 'size'
  | 'confidence'
  | 'ai_filename'
  | 'category'
  | 'classified_at'
  | 'deleted_at';

export type MediaTagMode = 'and' | 'or';

/**
 * List query parameters.
 *
 * `category`/`tag` are retained for compatibility. The newer fields are
 * additive and combine with them.
 */
export interface ListQuery {
  category?: string;
  tag?: string;
  /** Free-text search over AI filename, tags, source URL, and notes. */
  q?: string;
  mimeType?: 'image' | 'video';
  sourceDomain?: string;
  capturedFrom?: string;
  capturedTo?: string;
  starred?: boolean;
  classifyStatus?: TaskStatus;
  /** Multi-tag selection. Combined with `tagMode`. */
  tags?: string[];
  tagMode?: MediaTagMode;
  limit?: number;
  offset?: number;
  /** Opaque keyset cursor. Mutually exclusive with `offset`. */
  cursor?: string;
  orderBy?: MediaSortField;
  order?: 'asc' | 'desc';
  /** Which lifecycle state to include; defaults to active files only. */
  status?: 'active' | 'trashed' | 'all';
}

export interface ListFilesResult {
  items: FileMetadata[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface SourceDomainCount {
  domain: string;
  count: number;
}

interface CursorPayload {
  v: 1;
  sort: MediaSortField;
  order: 'asc' | 'desc';
  value: string | number;
  hash: string;
}

const SORT_EXPRESSIONS: Record<MediaSortField, string> = {
  captured_at: 'captured_at',
  size: 'size',
  confidence: 'confidence',
  ai_filename: "COALESCE(ai_filename, '')",
  category: 'category',
  classified_at: "COALESCE(classified_at, '')",
  deleted_at: "COALESCE(deleted_at, '')",
};

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(raw: string): CursorPayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8')
    ) as Partial<CursorPayload>;
    if (
      parsed.v !== 1 ||
      typeof parsed.sort !== 'string' ||
      !(parsed.sort in SORT_EXPRESSIONS) ||
      (parsed.order !== 'asc' && parsed.order !== 'desc') ||
      (typeof parsed.value !== 'string' && typeof parsed.value !== 'number') ||
      typeof parsed.hash !== 'string'
    ) {
      return null;
    }
    return parsed as CursorPayload;
  } catch {
    return null;
  }
}

function cursorValueOf(item: FileMetadata, field: MediaSortField): string | number {
  switch (field) {
    case 'ai_filename':
      return item.ai_filename ?? '';
    case 'classified_at':
      return item.classified_at ?? '';
    case 'deleted_at':
      return item.deleted_at ?? '';
    case 'captured_at':
      return item.captured_at;
    case 'category':
      return item.category;
    case 'size':
      return item.size;
    case 'confidence':
      return item.confidence;
  }
}

/**
 * Query for files indexed after a `(created_at, hash)` cursor.
 */
export interface ListFilesCreatedAfterParams {
  createdAt: string;
  hash: string;
  limit?: number;
}

/**
 * Metadata update parameters
 */
export interface MetadataUpdate {
  category?: string;
  ai_filename?: string;
  tags?: string[];
  confidence?: number;
  classified_at?: string;
  model_used?: string;
  is_starred?: boolean;
  user_notes?: string;
}

/**
 * Stats result
 */
export interface StatsResult {
  totalFiles: number;
  totalSize: number;
  images: number;
  videos: number;
  byCategory: Record<string, number>;
  trashFiles: number;
  trashSize: number;
}

/**
 * Build an actionable error for databases SQLite refuses to open.
 *
 * `SQLITE_CANTOPEN` ("unable to open database file") is what SQLite reports
 * when the workspace volume cannot provide the shared-memory files WAL needs,
 * which is typical for network shares (SMB/NFS) and some removable media.
 */
function databaseOpenError(dbPath: string, error: unknown): Error {
  const reason = error instanceof Error ? error.message : String(error);
  return new Error(
    `Unable to open workspace database at ${dbPath}: ${reason}. ` +
      'If the workspace lives on a network share or removable disk, copy vfs.db to a local ' +
      'disk, run `PRAGMA journal_mode = DELETE;` there, and copy it back (WAL journaling ' +
      'requires shared memory that those volumes do not provide).'
  );
}

/**
 * SQLiteDatabase class
 */
export class SQLiteDatabase {
  private db: Database.Database;
  private dbPath: string;
  private ftsAvailable = false;

  constructor(workspacePath: string) {
    this.dbPath = path.join(workspacePath, 'vfs.db');
    try {
      this.db = new Database(this.dbPath);
    } catch (error) {
      throw databaseOpenError(this.dbPath, error);
    }
    this.configureJournalMode();
    this.initializeSchema();
  }

  /**
   * Prefer WAL, but tolerate volumes where WAL is unavailable. A database
   * whose header already uses WAL cannot be opened on those volumes at all,
   * so report that case with recovery instructions instead of a bare error.
   */
  private configureJournalMode(): void {
    let mode: string;
    try {
      mode = this.db.pragma('journal_mode = WAL', { simple: true }) as string;
    } catch (error) {
      try {
        this.db.close();
      } catch {
        // Ignore close errors: the connection is already unusable.
      }
      throw databaseOpenError(this.dbPath, error);
    }

    if (mode !== 'wal') {
      console.warn(
        `[VFS] WAL journaling unavailable for ${this.dbPath}; using "${mode}" journal mode. ` +
          'This is expected on network shares and some removable disks.'
      );
    }
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    this.db.exec(FILES_TABLE_SCHEMA);
    this.db.exec(TASKS_TABLE_SCHEMA);
    this.db.exec(TAGS_TABLE_SCHEMA);
    this.migrateSourceDomainColumn();
    this.migrateSearchIndex();
    this.migrateClassifyQueue();
    this.backfillTagVocabulary();
  }

  /**
   * Add `source_domain` to pre-existing databases and backfill hostnames.
   */
  private migrateSourceDomainColumn(): void {
    const columns = this.db.prepare('PRAGMA table_info(files)').all() as Array<{
      name: string;
    }>;
    if (!columns.some((column) => column.name === 'source_domain')) {
      this.db.exec('ALTER TABLE files ADD COLUMN source_domain TEXT');
    }
    this.db.exec(
      'CREATE INDEX IF NOT EXISTS idx_files_source_domain ON files(source_domain) WHERE is_deleted = 0'
    );

    const rows = this.db
      .prepare(
        `SELECT hash, source_url FROM files
         WHERE source_url IS NOT NULL AND (source_domain IS NULL OR source_domain = '')`
      )
      .all() as Array<{ hash: string; source_url: string | null }>;
    if (rows.length === 0) return;

    const update = this.db.prepare('UPDATE files SET source_domain = ? WHERE hash = ?');
    const transaction = this.db.transaction(() => {
      for (const row of rows) {
        update.run(extractSourceDomain(row.source_url), row.hash);
      }
    });
    transaction();
  }

  /**
   * Create and backfill the FTS5 search index when the bundled SQLite
   * supports it. A missing FTS5 build degrades to LIKE substring matching.
   */
  private migrateSearchIndex(): void {
    const existing = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'files_fts'")
      .get() as { name: string } | undefined;

    if (!existing) {
      try {
        this.db.exec(
          `CREATE VIRTUAL TABLE files_fts USING fts5(hash UNINDEXED, search_text, tokenize='trigram')`
        );
      } catch {
        try {
          this.db.exec(`CREATE VIRTUAL TABLE files_fts USING fts5(hash UNINDEXED, search_text)`);
        } catch (error) {
          this.ftsAvailable = false;
          console.warn(
            '[VFS] FTS5 is unavailable; media text search will use substring matching.',
            error instanceof Error ? error.message : error
          );
          return;
        }
      }
    }

    this.ftsAvailable = true;
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS files_fts_ai AFTER INSERT ON files BEGIN
        INSERT INTO files_fts(hash, search_text)
        VALUES (
          new.hash,
          COALESCE(new.ai_filename, '') || ' ' ||
          COALESCE(new.tags, '') || ' ' ||
          COALESCE(new.source_url, '') || ' ' ||
          COALESCE(new.user_notes, '')
        );
      END;

      CREATE TRIGGER IF NOT EXISTS files_fts_ad AFTER DELETE ON files BEGIN
        DELETE FROM files_fts WHERE hash = old.hash;
      END;

      CREATE TRIGGER IF NOT EXISTS files_fts_au
      AFTER UPDATE OF ai_filename, tags, source_url, user_notes ON files BEGIN
        DELETE FROM files_fts WHERE hash = old.hash;
        INSERT INTO files_fts(hash, search_text)
        VALUES (
          new.hash,
          COALESCE(new.ai_filename, '') || ' ' ||
          COALESCE(new.tags, '') || ' ' ||
          COALESCE(new.source_url, '') || ' ' ||
          COALESCE(new.user_notes, '')
        );
      END;
    `);

    const version = this.db.pragma('user_version', { simple: true }) as number;
    if (version < SEARCH_SCHEMA_VERSION) {
      const transaction = this.db.transaction(() => {
        this.db.exec('DELETE FROM files_fts');
        this.db.exec(`
          INSERT INTO files_fts(hash, search_text)
          SELECT
            hash,
            COALESCE(ai_filename, '') || ' ' ||
            COALESCE(tags, '') || ' ' ||
            COALESCE(source_url, '') || ' ' ||
            COALESCE(user_notes, '')
          FROM files
        `);
        this.db.pragma(`user_version = ${SEARCH_SCHEMA_VERSION}`);
      });
      transaction();
    }
  }

  /**
   * Whether FTS5 tokenization is available for text queries.
   */
  isSearchIndexAvailable(): boolean {
    return this.ftsAvailable;
  }

  /**
   * Seed the vocabulary from tags already present on files (legacy user tags).
   * Runs once, when the vocabulary is still empty.
   */
  private backfillTagVocabulary(): void {
    const count = this.db.prepare('SELECT COUNT(*) as count FROM tags').get() as {
      count: number;
    };
    if (count.count > 0) return;

    const rows = this.db.prepare('SELECT tags FROM files WHERE tags IS NOT NULL').all() as Array<{
      tags: string | null;
    }>;
    const seen = new Set<string>();
    const transaction = this.db.transaction(() => {
      for (const row of rows) {
        for (const tag of parseTagList(row.tags)) {
          if (tag.startsWith('system:')) continue;
          const normalized = normalizeTagName(tag);
          if (!normalized || seen.has(normalized)) continue;
          seen.add(normalized);
          this.ensureTag(normalized, 'user');
        }
      }
      if (seen.size > 0) this.recomputeTagUsage();
    });
    transaction();
  }

  /**
   * Migrate the legacy `classify_queue` table into the unified `tasks` table.
   * The old table is dropped once its rows have been copied.
   */
  private migrateClassifyQueue(): void {
    const table = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'classify_queue'")
      .get() as { name: string } | undefined;
    if (!table) return;

    const columns = this.db.prepare('PRAGMA table_info(classify_queue)').all() as Array<{
      name: string;
    }>;
    const has = (column: string) => columns.some((c) => c.name === column);
    const retriesExpr = has('retries') ? 'COALESCE(retries, 0)' : '0';
    const addedAtExpr = has('added_at') ? 'added_at' : "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

    const migrate = this.db.transaction(() => {
      this.db
        .prepare(
          `
          INSERT OR IGNORE INTO tasks (
            task_type, target_hash, status, priority, attempts, max_attempts,
            next_run_at, started_at, completed_at, error, created_at, updated_at
          )
          SELECT
            'classify', hash, COALESCE(status, 'pending'), COALESCE(priority, 5),
            ${retriesExpr}, 3, NULL, started_at, completed_at, error,
            ${addedAtExpr}, ${addedAtExpr}
          FROM classify_queue
          WHERE hash IN (SELECT hash FROM files)
        `
        )
        .run();
      this.db.exec('DROP TABLE classify_queue');
    });
    migrate();
  }

  /**
   * Insert a new file record
   */
  insertFile(
    metadata: Omit<FileMetadata, 'created_at' | 'updated_at' | 'source_domain'> & {
      source_domain?: string | null;
    }
  ): void {
    const now = new Date().toISOString();
    const sourceDomain = metadata.source_domain ?? extractSourceDomain(metadata.source_url ?? null);
    const stmt = this.db.prepare(`
      INSERT INTO files (
        hash, blob_ext, mime_type, size, source_url, source_domain, captured_at,
        category, ai_filename, tags, confidence, classified_at, model_used,
        is_starred, user_notes, is_deleted, deleted_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      metadata.hash,
      metadata.blob_ext,
      metadata.mime_type,
      metadata.size,
      metadata.source_url,
      sourceDomain,
      metadata.captured_at,
      metadata.category,
      metadata.ai_filename,
      metadata.tags,
      metadata.confidence,
      metadata.classified_at,
      metadata.model_used,
      metadata.is_starred,
      metadata.user_notes,
      metadata.is_deleted,
      metadata.deleted_at,
      now,
      now
    );
  }

  /**
   * Get file metadata by hash
   */
  getFile(hash: string): FileMetadata | null {
    const stmt = this.db.prepare('SELECT * FROM files WHERE hash = ?');
    const row = stmt.get(hash) as FileMetadata | undefined;
    return row || null;
  }

  /**
   * Check if file exists by hash
   */
  fileExists(hash: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM files WHERE hash = ?');
    return stmt.get(hash) !== undefined;
  }

  /**
   * Update file metadata
   */
  updateMetadata(hash: string, updates: MetadataUpdate): boolean {
    const file = this.getFile(hash);
    if (!file) return false;

    const now = new Date().toISOString();
    const updateFields: string[] = [];
    const updateValues: unknown[] = [];

    if (updates.category !== undefined) {
      updateFields.push('category = ?');
      updateValues.push(updates.category);
    }
    if (updates.ai_filename !== undefined) {
      updateFields.push('ai_filename = ?');
      updateValues.push(updates.ai_filename);
    }
    if (updates.tags !== undefined) {
      updateFields.push('tags = ?');
      updateValues.push(JSON.stringify(updates.tags));
    }
    if (updates.confidence !== undefined) {
      updateFields.push('confidence = ?');
      updateValues.push(updates.confidence);
    }
    if (updates.classified_at !== undefined) {
      updateFields.push('classified_at = ?');
      updateValues.push(updates.classified_at);
    }
    if (updates.model_used !== undefined) {
      updateFields.push('model_used = ?');
      updateValues.push(updates.model_used);
    }
    if (updates.is_starred !== undefined) {
      updateFields.push('is_starred = ?');
      updateValues.push(updates.is_starred ? 1 : 0);

      // Sync system:starred tag
      let tags: string[] = [];
      if (file.tags) {
        try {
          const parsedTags = JSON.parse(file.tags);
          if (Array.isArray(parsedTags)) {
            tags = parsedTags;
          }
        } catch {
          // ignore
        }
      }
      if (updates.is_starred) {
        if (!tags.includes('system:starred')) {
          tags.push('system:starred');
        }
      } else {
        tags = tags.filter((t) => t !== 'system:starred');
      }
      // Update tags field if it was changed
      updateFields.push('tags = ?');
      updateValues.push(tags.length > 0 ? JSON.stringify(tags) : null);
    }
    if (updates.user_notes !== undefined) {
      updateFields.push('user_notes = ?');
      updateValues.push(updates.user_notes);
    }

    if (updateFields.length === 0) return false;

    updateFields.push('updated_at = ?');
    updateValues.push(now);
    updateValues.push(hash);

    const stmt = this.db.prepare(`
      UPDATE files SET ${updateFields.join(', ')} WHERE hash = ?
    `);
    stmt.run(...updateValues);
    return true;
  }

  /**
   * Set the star state while preserving every other tag.
   */
  setFileStarred(hash: string, starred: boolean): FileMetadata | null {
    const file = this.getFile(hash);
    if (!file) return null;

    const now = new Date().toISOString();
    const tags = parseTagList(file.tags).filter((tag) => tag !== 'system:starred');
    if (starred) {
      tags.push('system:starred');
    }

    const transaction = this.db.transaction(() => {
      this.db
        .prepare('UPDATE files SET is_starred = ?, tags = ?, updated_at = ? WHERE hash = ?')
        .run(starred ? 1 : 0, tags.length > 0 ? JSON.stringify(tags) : null, now, hash);
    });
    transaction();
    return this.getFile(hash);
  }

  /**
   * Update user notes. The search trigger refreshes the FTS row.
   */
  updateFileNotes(hash: string, notes: string): FileMetadata | null {
    const file = this.getFile(hash);
    if (!file) return null;
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE files SET user_notes = ?, updated_at = ? WHERE hash = ?')
      .run(notes, now, hash);
    return this.getFile(hash);
  }

  /**
   * Add user tags to a file, creating vocabulary entries as needed.
   */
  addFileTags(hash: string, names: string[]): { tags: string[] } {
    const file = this.getFile(hash);
    if (!file) throw new Error(`File not found: ${hash}`);

    const normalized = names.map((name) => normalizeTagName(name)).filter(Boolean);
    for (const name of normalized) {
      if (name.startsWith('system:') || RESERVED_TAG_NAMES.has(name)) {
        throw new Error(`Reserved tag name: ${name}`);
      }
    }

    const now = new Date().toISOString();
    let nextTags: string[] = [];

    const transaction = this.db.transaction(() => {
      const tags = parseTagList(file.tags);
      const added: string[] = [];
      for (const name of normalized) {
        const tag = this.ensureTag(name, 'user');
        if (!tags.includes(tag.name)) {
          tags.push(tag.name);
          added.push(tag.name);
        }
      }
      if (added.length > 0) {
        this.db
          .prepare('UPDATE files SET tags = ?, updated_at = ? WHERE hash = ?')
          .run(JSON.stringify(tags), now, hash);
        if (file.is_deleted === 0) {
          const bump = this.db.prepare(
            'UPDATE tags SET usage_count = usage_count + 1, updated_at = ? WHERE name = ?'
          );
          for (const name of added) {
            bump.run(now, name);
          }
        }
      }
      nextTags = tags;
    });
    transaction();

    return { tags: nextTags };
  }

  /**
   * Remove user tags from a file. System tags are never removed.
   */
  removeFileTags(hash: string, names: string[]): { tags: string[] } {
    const file = this.getFile(hash);
    if (!file) throw new Error(`File not found: ${hash}`);

    const targets = new Set(
      names
        .map((name) => normalizeTagName(name))
        .filter((name) => name && !name.startsWith('system:'))
    );
    const now = new Date().toISOString();
    let nextTags: string[] = [];

    const transaction = this.db.transaction(() => {
      const tags = parseTagList(file.tags);
      const removed = tags.filter((tag) => targets.has(tag.toLowerCase()));
      const remaining = tags.filter((tag) => !targets.has(tag.toLowerCase()));
      if (removed.length > 0) {
        this.db
          .prepare('UPDATE files SET tags = ?, updated_at = ? WHERE hash = ?')
          .run(remaining.length > 0 ? JSON.stringify(remaining) : null, now, hash);
        if (file.is_deleted === 0) {
          const decrement = this.db.prepare(
            'UPDATE tags SET usage_count = MAX(0, usage_count - 1), updated_at = ? WHERE name = ?'
          );
          for (const name of removed) {
            decrement.run(now, name);
          }
        }
      }
      nextTags = remaining;
    });
    transaction();

    return { tags: nextTags };
  }

  /**
   * Move a file into the recycle bin. The blob and thumbnails are retained so
   * the file can be restored or previewed.
   */
  softDeleteFile(hash: string): boolean {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE files SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE hash = ?
    `);
    const result = stmt.run(now, now, hash);
    if (result.changes > 0) this.recomputeTagUsage();
    return result.changes > 0;
  }

  /**
   * Permanently delete a file row and its tasks.
   */
  hardDeleteFile(hash: string): boolean {
    return this.hardDeleteFiles([hash]) > 0;
  }

  /**
   * Permanently delete multiple file rows and their tasks in one transaction.
   */
  hardDeleteFiles(hashes: string[]): number {
    if (hashes.length === 0) return 0;

    const deleteTasks = this.db.prepare('DELETE FROM tasks WHERE target_hash = ?');
    const deleteFile = this.db.prepare('DELETE FROM files WHERE hash = ?');

    const remove = this.db.transaction((items: string[]) => {
      let removed = 0;
      for (const hash of items) {
        deleteTasks.run(hash);
        removed += deleteFile.run(hash).changes;
      }
      return removed;
    });

    const removed = remove(hashes);
    if (removed > 0) this.recomputeTagUsage();
    return removed;
  }

  /**
   * Restore a file from the recycle bin.
   */
  restoreFile(hash: string): boolean {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE files SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE hash = ?
    `);
    const result = stmt.run(now, hash);
    if (result.changes > 0) this.recomputeTagUsage();
    return result.changes > 0;
  }

  /**
   * Restore every file in the recycle bin.
   */
  restoreAllFiles(): number {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE files SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE is_deleted = 1
    `);
    const result = stmt.run(now);
    if (result.changes > 0) this.recomputeTagUsage();
    return result.changes;
  }

  /**
   * List every file currently in the recycle bin.
   */
  listTrashedFiles(): FileMetadata[] {
    return this.db
      .prepare(`SELECT * FROM files WHERE is_deleted = 1 ORDER BY deleted_at DESC`)
      .all() as FileMetadata[];
  }

  /**
   * List files with pagination, text search, structured filters, and sorting.
   */
  listFiles(query: ListQuery): ListFilesResult {
    const status = query.status ?? 'active';
    const orderBy = query.orderBy ?? (status === 'trashed' ? 'deleted_at' : 'captured_at');
    const sortExpr = SORT_EXPRESSIONS[orderBy];
    if (!sortExpr) {
      throw new Error(`Invalid orderBy: ${String(orderBy)}`);
    }
    const order = query.order === 'asc' ? 'asc' : 'desc';
    const direction = order === 'desc' ? 'DESC' : 'ASC';

    const rawLimit = query.limit ?? 50;
    if (!Number.isFinite(rawLimit)) {
      throw new Error('Invalid limit');
    }
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(rawLimit)));

    const rawOffset = query.offset ?? 0;
    if (!Number.isFinite(rawOffset) || rawOffset < 0) {
      throw new Error('Invalid offset');
    }
    const offset = Math.floor(rawOffset);

    const conditions: string[] = [];
    const baseValues: unknown[] = [];

    if (status === 'active') {
      conditions.push('is_deleted = 0');
    } else if (status === 'trashed') {
      conditions.push('is_deleted = 1');
    }

    if (query.category) {
      conditions.push('category = ?');
      baseValues.push(query.category);
    }

    if (query.tag) {
      const tagCondition = this.buildSingleTagCondition(query.tag);
      if (tagCondition.sql) {
        conditions.push(tagCondition.sql);
        baseValues.push(...tagCondition.values);
      }
    }

    if (query.tags && query.tags.length > 0) {
      const tagConditions = query.tags
        .map((tag) => this.buildSingleTagCondition(tag))
        .filter((condition) => condition.sql);
      if (tagConditions.length > 0) {
        const joiner = query.tagMode === 'and' ? ' AND ' : ' OR ';
        conditions.push(`(${tagConditions.map((condition) => condition.sql).join(joiner)})`);
        for (const condition of tagConditions) {
          baseValues.push(...condition.values);
        }
      }
    }

    if (query.mimeType === 'image' || query.mimeType === 'video') {
      conditions.push('mime_type LIKE ?');
      baseValues.push(`${query.mimeType}/%`);
    }

    if (query.sourceDomain) {
      conditions.push('source_domain = ?');
      baseValues.push(query.sourceDomain.toLowerCase());
    }

    if (query.capturedFrom) {
      conditions.push('captured_at >= ?');
      baseValues.push(query.capturedFrom);
    }

    if (query.capturedTo) {
      conditions.push('captured_at <= ?');
      baseValues.push(query.capturedTo);
    }

    if (query.starred === true) {
      conditions.push('is_starred = 1');
    }

    if (query.classifyStatus) {
      if (query.classifyStatus === 'pending') {
        conditions.push(`(
          NOT EXISTS (SELECT 1 FROM tasks t WHERE t.target_hash = files.hash AND t.task_type = 'classify')
          OR EXISTS (SELECT 1 FROM tasks t WHERE t.target_hash = files.hash AND t.task_type = 'classify' AND t.status = 'pending')
        )`);
      } else {
        conditions.push(
          `EXISTS (SELECT 1 FROM tasks t WHERE t.target_hash = files.hash AND t.task_type = 'classify' AND t.status = ?)`
        );
        baseValues.push(query.classifyStatus);
      }
    }

    const textQuery = query.q?.trim();
    if (textQuery) {
      const hasCjk = /[㐀-鿿]/.test(textQuery);
      if (this.ftsAvailable && textQuery.length >= 3 && !hasCjk) {
        conditions.push('hash IN (SELECT hash FROM files_fts WHERE files_fts MATCH ?)');
        baseValues.push(`"${textQuery.replace(/"/g, '""')}"`);
      } else {
        conditions.push(`(
          COALESCE(ai_filename, '') || ' ' ||
          COALESCE(tags, '') || ' ' ||
          COALESCE(source_url, '') || ' ' ||
          COALESCE(user_notes, '')
        ) LIKE ? ESCAPE '\\'`);
        baseValues.push(`%${escapeLikePattern(textQuery)}%`);
      }
    }

    // Count ignores the cursor so the caller always sees the full result size.
    const baseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM files ${baseWhere}`);
    const total = (countStmt.get(...baseValues) as { count: number }).count;

    let cursor: CursorPayload | null = null;
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded && decoded.sort === orderBy && decoded.order === order) {
        cursor = decoded;
      }
    }

    const pageConditions = [...conditions];
    const pageValues = [...baseValues];
    if (cursor) {
      const compare = order === 'desc' ? '<' : '>';
      pageConditions.push(`(${sortExpr} ${compare} ? OR (${sortExpr} = ? AND hash ${compare} ?))`);
      pageValues.push(cursor.value, cursor.value, cursor.hash);
    }

    const whereClause = pageConditions.length > 0 ? `WHERE ${pageConditions.join(' AND ')}` : '';
    const pageLimit = cursor ? limit + 1 : limit;
    const pageSql = `SELECT * FROM files ${whereClause} ORDER BY ${sortExpr} ${direction}, hash ${direction} LIMIT ?${
      cursor ? '' : ' OFFSET ?'
    }`;
    const pageParams = cursor ? [...pageValues, pageLimit] : [...pageValues, pageLimit, offset];

    const rows = this.db.prepare(pageSql).all(...pageParams) as FileMetadata[];

    const hasMore = cursor ? rows.length > limit : offset + rows.length < total;
    const items = cursor ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && items.length > 0
        ? encodeCursor({
            v: 1,
            sort: orderBy,
            order,
            value: cursorValueOf(items[items.length - 1], orderBy),
            hash: items[items.length - 1].hash,
          })
        : undefined;

    return { items, total, hasMore, nextCursor };
  }

  /**
   * Build the WHERE fragment for one tag, handling legacy special names and
   * both plain and `system:` storage forms.
   */
  private buildSingleTagCondition(tag: string): { sql: string; values: unknown[] } {
    const normalized = tag.trim();
    if (!normalized || normalized === 'all') {
      return { sql: '', values: [] };
    }
    if (normalized === 'uncategorized') {
      return {
        sql: `(tags IS NULL OR tags = '[]' OR NOT EXISTS (
          SELECT 1 FROM json_each(tags) WHERE json_each.value NOT LIKE 'system:%'
        ))`,
        values: [],
      };
    }
    if (normalized === 'image' || normalized === 'video') {
      return { sql: 'mime_type LIKE ?', values: [`${normalized}/%`] };
    }
    if (normalized === 'starred') {
      return { sql: 'is_starred = 1', values: [] };
    }
    return {
      sql: `(
        EXISTS (SELECT 1 FROM json_each(tags) WHERE json_each.value = ?)
        OR EXISTS (SELECT 1 FROM json_each(tags) WHERE json_each.value = ?)
      )`,
      values: [normalized, `system:${normalized}`],
    };
  }

  /**
   * Distinct source domains for the library filter, ordered by file count.
   */
  getSourceDomains(limit: number = 100): SourceDomainCount[] {
    const bounded = Math.min(500, Math.max(1, Math.floor(limit)));
    return this.db
      .prepare(
        `SELECT source_domain AS domain, COUNT(*) AS count
         FROM files
         WHERE is_deleted = 0 AND source_domain IS NOT NULL AND source_domain != ''
         GROUP BY source_domain
         ORDER BY count DESC, source_domain ASC
         LIMIT ?`
      )
      .all(bounded) as SourceDomainCount[];
  }

  /**
   * List files strictly after a keyset cursor, ordered by `(created_at, hash)`.
   * Used by incremental consumers such as the media archive worker.
   */
  listFilesCreatedAfter(params: ListFilesCreatedAfterParams): FileMetadata[] {
    const limit = Math.max(1, Math.floor(params.limit ?? 200));
    const stmt = this.db.prepare(`
      SELECT * FROM files
      WHERE is_deleted = 0
        AND (created_at > ? OR (created_at = ? AND hash > ?))
      ORDER BY created_at ASC, hash ASC
      LIMIT ?
    `);
    return stmt.all(params.createdAt, params.createdAt, params.hash, limit) as FileMetadata[];
  }

  /**
   * Get tag usage counts
   */
  getTagCounts(): Record<string, number> {
    const counts: Record<string, number> = {};

    // Aggregate totals and system tags directly in SQL instead of loading
    // every file row into JS and JSON.parsing each tags field.
    const totals = this.db
      .prepare(
        `
        SELECT
          COUNT(*) AS all_count,
          COALESCE(SUM(CASE WHEN mime_type LIKE 'image/%' THEN 1 ELSE 0 END), 0) AS image,
          COALESCE(SUM(CASE WHEN mime_type LIKE 'video/%' THEN 1 ELSE 0 END), 0) AS video,
          COALESCE(SUM(CASE WHEN is_starred = 1 THEN 1 ELSE 0 END), 0) AS starred
        FROM files WHERE is_deleted = 0
      `
      )
      .get() as { all_count: number; image: number; video: number; starred: number };

    counts.all = totals.all_count;
    if (totals.image) counts.image = totals.image;
    if (totals.video) counts.video = totals.video;
    if (totals.starred) counts.starred = totals.starred;

    // User tags (non-system) via SQLite's json_each.
    const tagRows = this.db
      .prepare(
        `
        SELECT json_each.value AS tag, COUNT(*) AS count
        FROM files, json_each(files.tags)
        WHERE files.is_deleted = 0
          AND json_each.type = 'text'
          AND json_each.value NOT LIKE 'system:%'
        GROUP BY json_each.value
      `
      )
      .all() as Array<{ tag: string; count: number }>;
    for (const row of tagRows) {
      counts[row.tag] = (counts[row.tag] || 0) + row.count;
    }

    // Files with no user tags.
    const uncategorizedRow = this.db
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM files
        WHERE is_deleted = 0
          AND NOT EXISTS (
            SELECT 1 FROM json_each(files.tags)
            WHERE json_each.type = 'text' AND json_each.value NOT LIKE 'system:%'
          )
      `
      )
      .get() as { count: number };
    if (uncategorizedRow.count) counts.uncategorized = uncategorizedRow.count;

    return counts;
  }

  /**
   * Get statistics
   */
  getStats(): StatsResult {
    // Total and size
    const totalStmt = this.db.prepare(`
      SELECT COUNT(*) as count, SUM(size) as total_size
      FROM files WHERE is_deleted = 0
    `);
    const totalResult = totalStmt.get() as { count: number; total_size: number | null };

    // Images vs videos
    const imagesStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM files
      WHERE is_deleted = 0 AND mime_type LIKE 'image/%'
    `);
    const imagesResult = imagesStmt.get() as { count: number };

    const videosStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM files
      WHERE is_deleted = 0 AND mime_type LIKE 'video/%'
    `);
    const videosResult = videosStmt.get() as { count: number };

    // By category
    const categoryStmt = this.db.prepare(`
      SELECT category, COUNT(*) as count FROM files
      WHERE is_deleted = 0
      GROUP BY category
    `);
    const categoryRows = categoryStmt.all() as { category: string; count: number }[];
    const byCategory: Record<string, number> = {};
    for (const row of categoryRows) {
      byCategory[row.category] = row.count;
    }

    // Trash totals
    const trashStmt = this.db.prepare(`
      SELECT COUNT(*) as count, SUM(size) as total_size
      FROM files WHERE is_deleted = 1
    `);
    const trashResult = trashStmt.get() as { count: number; total_size: number | null };

    return {
      totalFiles: totalResult.count,
      totalSize: totalResult.total_size ?? 0,
      images: imagesResult.count,
      videos: videosResult.count,
      byCategory,
      trashFiles: trashResult.count,
      trashSize: trashResult.total_size ?? 0,
    };
  }

  /**
   * Enqueue a typed task for a hash.
   *
   * By default enqueueing is idempotent: an existing row for the same
   * `(task_type, target_hash)` is left untouched, so captured media never
   * resurrects a task the user already refreshed or the engine already ran.
   */
  enqueueTask(params: EnqueueTaskParams): boolean {
    const { taskType, hash, priority = 5, maxAttempts = 3, requeue = false } = params;
    if (!this.fileExists(hash)) return false;

    const now = new Date().toISOString();
    if (requeue) {
      const stmt = this.db.prepare(`
        INSERT INTO tasks (
          task_type, target_hash, status, priority, attempts, max_attempts,
          next_run_at, started_at, completed_at, error, created_at, updated_at
        ) VALUES (?, ?, 'pending', ?, 0, ?, NULL, NULL, NULL, NULL, ?, ?)
        ON CONFLICT(task_type, target_hash) DO UPDATE SET
          status = 'pending',
          priority = excluded.priority,
          max_attempts = excluded.max_attempts,
          attempts = 0,
          next_run_at = NULL,
          started_at = NULL,
          completed_at = NULL,
          error = NULL,
          updated_at = excluded.updated_at
      `);
      stmt.run(taskType, hash, priority, maxAttempts, now, now);
      return true;
    }

    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        task_type, target_hash, status, priority, attempts, max_attempts,
        next_run_at, started_at, completed_at, error, created_at, updated_at
      ) VALUES (?, ?, 'pending', ?, 0, ?, NULL, NULL, NULL, NULL, ?, ?)
      ON CONFLICT(task_type, target_hash) DO NOTHING
    `);
    stmt.run(taskType, hash, priority, maxAttempts, now, now);
    return true;
  }

  /**
   * Legacy classification enqueue (requeues an existing row).
   */
  enqueueClassification(hash: string, priority: number = 5): boolean {
    return this.enqueueTask({ taskType: 'classify', hash, priority, requeue: true });
  }

  /**
   * Atomically claim up to `limit` due tasks for processing.
   */
  claimTasks(limit: number, taskTypes?: TaskType[]): TaskItem[] {
    if (limit <= 0) return [];
    const now = new Date().toISOString();
    const typeFilter =
      taskTypes && taskTypes.length > 0
        ? `AND task_type IN (${taskTypes.map(() => '?').join(', ')})`
        : '';
    const selectStmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE status = 'pending' AND (next_run_at IS NULL OR next_run_at <= ?) ${typeFilter}
        AND EXISTS (
          SELECT 1 FROM files f WHERE f.hash = tasks.target_hash AND f.is_deleted = 0
        )
      ORDER BY priority DESC, created_at ASC
      LIMIT ?
    `);
    const updateStmt = this.db.prepare(`
      UPDATE tasks
      SET status = 'processing', started_at = ?, updated_at = ?, error = NULL
      WHERE id = ? AND status = 'pending'
    `);

    const claimed: TaskItem[] = [];
    const transaction = this.db.transaction(() => {
      const rows = selectStmt.all(now, ...(taskTypes ?? []), limit) as TaskItem[];
      for (const row of rows) {
        const result = updateStmt.run(now, now, row.id);
        if (result.changes > 0) {
          claimed.push({ ...row, status: 'processing', started_at: now, updated_at: now });
        }
      }
    });
    transaction();
    return claimed;
  }

  /**
   * Update a typed task's status, applying failure backoff.
   */
  updateTaskStatus(params: UpdateTaskStatusParams): boolean;
  updateTaskStatus(hash: string, status: TaskStatus, error?: string): boolean;
  updateTaskStatus(
    paramsOrHash: UpdateTaskStatusParams | string,
    status?: TaskStatus,
    error?: string
  ): boolean {
    const now = new Date().toISOString();

    // Legacy classification-only signature: `failed` is terminal, no backoff.
    if (typeof paramsOrHash === 'string') {
      const nextStatus = status ?? 'pending';
      if (nextStatus === 'processing') {
        this.db
          .prepare(
            `UPDATE tasks SET status = 'processing', started_at = ?, updated_at = ?, error = NULL
             WHERE task_type = 'classify' AND target_hash = ?`
          )
          .run(now, now, paramsOrHash);
      } else if (nextStatus === 'completed') {
        this.db
          .prepare(
            `UPDATE tasks SET status = 'completed', completed_at = ?, updated_at = ?, error = NULL
             WHERE task_type = 'classify' AND target_hash = ?`
          )
          .run(now, now, paramsOrHash);
      } else if (nextStatus === 'failed') {
        this.db
          .prepare(
            `UPDATE tasks SET status = 'failed', error = ?, attempts = attempts + 1, updated_at = ?
             WHERE task_type = 'classify' AND target_hash = ?`
          )
          .run(error ?? 'Unknown error', now, paramsOrHash);
      } else {
        this.db
          .prepare(
            `UPDATE tasks SET status = 'pending', next_run_at = NULL, started_at = NULL,
               error = NULL, updated_at = ?
             WHERE task_type = 'classify' AND target_hash = ?`
          )
          .run(now, paramsOrHash);
      }
      return true;
    }

    const { taskType, hash, status: nextStatus, error: taskError, retryDelayMs } = paramsOrHash;

    if (nextStatus === 'processing') {
      const stmt = this.db.prepare(`
        UPDATE tasks SET status = 'processing', started_at = ?, updated_at = ?, error = NULL
        WHERE task_type = ? AND target_hash = ?
      `);
      stmt.run(now, now, taskType, hash);
      return true;
    }

    if (nextStatus === 'completed') {
      const stmt = this.db.prepare(`
        UPDATE tasks SET status = 'completed', completed_at = ?, updated_at = ?, error = NULL
        WHERE task_type = ? AND target_hash = ?
      `);
      stmt.run(now, now, taskType, hash);
      return true;
    }

    if (nextStatus === 'failed') {
      const nextRunAt = retryDelayMs ? new Date(Date.now() + retryDelayMs).toISOString() : null;
      const stmt = this.db.prepare(`
        UPDATE tasks
        SET attempts = attempts + 1,
            status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
            next_run_at = CASE WHEN attempts + 1 >= max_attempts THEN NULL ELSE ? END,
            started_at = NULL,
            error = ?,
            updated_at = ?
        WHERE task_type = ? AND target_hash = ?
      `);
      stmt.run(nextRunAt, taskError ?? 'Unknown error', now, taskType, hash);
      return true;
    }

    if (nextStatus === 'skipped') {
      // Terminal: the media is not applicable to the AI pipeline. Nothing is
      // retried, so attempts and completed_at are left untouched.
      const stmt = this.db.prepare(`
        UPDATE tasks
        SET status = 'skipped',
            next_run_at = NULL,
            started_at = NULL,
            error = ?,
            updated_at = ?
        WHERE task_type = ? AND target_hash = ?
      `);
      stmt.run(taskError ?? 'Media is not processable by the AI pipeline', now, taskType, hash);
      return true;
    }

    const stmt = this.db.prepare(`
      UPDATE tasks SET status = 'pending', next_run_at = NULL, started_at = NULL, error = NULL,
        updated_at = ? WHERE task_type = ? AND target_hash = ?
    `);
    stmt.run(now, taskType, hash);
    return true;
  }

  /**
   * Requeue a single typed task, resetting attempts and backoff.
   *
   * Files indexed before the typed task engine may have no row for this type
   * yet, so a manual single-file refresh falls back to creating one.
   */
  requeueTask(taskType: TaskType, hash: string): boolean {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE tasks
      SET status = 'pending', attempts = 0, next_run_at = NULL, started_at = NULL,
          completed_at = NULL, error = NULL, updated_at = ?
      WHERE task_type = ? AND target_hash = ?
    `);
    if (stmt.run(now, taskType, hash).changes > 0) return true;
    return this.enqueueTask({ taskType, hash, requeue: true });
  }

  /**
   * Record a terminal skipped task for media the AI pipeline cannot process.
   *
   * Creates the row when absent and converts `pending`/`failed` rows.
   * `completed` rows are preserved: skipping must not erase a real result.
   */
  recordSkippedTask(params: RecordSkippedTaskParams): boolean {
    const { taskType, hash, error, priority = 5, maxAttempts = 3 } = params;
    if (!this.fileExists(hash)) return false;

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        task_type, target_hash, status, priority, attempts, max_attempts,
        next_run_at, started_at, completed_at, error, created_at, updated_at
      ) VALUES (?, ?, 'skipped', ?, 0, ?, NULL, NULL, NULL, ?, ?, ?)
      ON CONFLICT(task_type, target_hash) DO UPDATE SET
        status = 'skipped',
        next_run_at = NULL,
        started_at = NULL,
        error = excluded.error,
        updated_at = excluded.updated_at
      WHERE tasks.status IN ('pending', 'failed')
    `);
    stmt.run(taskType, hash, priority, maxAttempts, error, now, now);
    return true;
  }

  /**
   * Requeue every eligible task of a type (full rescan), creating rows for
   * files that never had that task type. Ineligible media becomes or remains
   * skipped and is never reset to pending.
   */
  requeueAll(params: RequeueAllParams = {}): number {
    const { taskType } = params;
    const ineligible = this.normalizeMimeTypes(params.ineligibleMimeTypes);
    const skipError = params.skipError ?? SKIPPED_MEDIA_ERROR;
    const now = new Date().toISOString();

    const transaction = this.db.transaction(() => {
      if (ineligible.length > 0) {
        this.markIneligibleTasksSkipped({
          mimeTypes: ineligible,
          statuses: ['pending', 'failed'],
          taskType,
          error: skipError,
          now,
        });
      }

      if (taskType) {
        const fileFilter =
          ineligible.length > 0
            ? `AND mime_type NOT IN (${ineligible.map(() => '?').join(', ')})`
            : '';
        this.db
          .prepare(
            `INSERT INTO tasks (
               task_type, target_hash, status, priority, attempts, max_attempts,
               next_run_at, started_at, completed_at, error, created_at, updated_at
             )
             SELECT ?, hash, 'pending', 5, 0, 3, NULL, NULL, NULL, NULL, ?, ?
             FROM files WHERE is_deleted = 0 ${fileFilter}
             ON CONFLICT(task_type, target_hash) DO NOTHING`
          )
          .run(taskType, now, now, ...ineligible);
      }

      const typeFilter = taskType ? 'AND task_type = ?' : '';
      const eligibleFilter =
        ineligible.length > 0
          ? `AND target_hash NOT IN (${this.ineligibleHashSubquery(ineligible)})`
          : '';
      return this.db
        .prepare(
          `UPDATE tasks
           SET status = 'pending', attempts = 0, next_run_at = NULL, started_at = NULL,
               completed_at = NULL, error = NULL, updated_at = ?
           WHERE 1 = 1 ${typeFilter} ${eligibleFilter}`
        )
        .run(now, ...(taskType ? [taskType] : []), ...ineligible).changes;
    });
    return transaction();
  }

  /**
   * Convert persisted pending/failed tasks for ineligible media to skipped.
   */
  skipIneligibleTasks(params: SkipIneligibleTasksParams): number {
    const mimeTypes = this.normalizeMimeTypes(params.ineligibleMimeTypes);
    if (mimeTypes.length === 0) return 0;

    return this.markIneligibleTasksSkipped({
      mimeTypes,
      statuses: ['pending', 'failed'],
      taskTypes: params.taskTypes,
      error: params.error,
      now: new Date().toISOString(),
    });
  }

  /**
   * Distinct MIME types currently stored in the index.
   */
  getDistinctMimeTypes(): string[] {
    const rows = this.db
      .prepare('SELECT DISTINCT mime_type FROM files WHERE is_deleted = 0')
      .all() as Array<{ mime_type: string }>;
    return rows.map((row) => row.mime_type).filter(Boolean);
  }

  /**
   * Recover tasks left in `processing` by a terminated service worker.
   */
  recoverStaleProcessingTasks(): number {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE tasks
      SET status = 'pending', started_at = NULL, next_run_at = NULL, updated_at = ?
      WHERE status = 'processing'
    `);
    return stmt.run(now).changes;
  }

  /**
   * Get all task rows for a hash.
   */
  getTasksByHash(hash: string): TaskItem[] {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE target_hash = ? ORDER BY task_type');
    return stmt.all(hash) as TaskItem[];
  }

  /**
   * Get next pending classification task (legacy).
   */
  getNextPendingTask(): QueueItem | null {
    const row = this.db
      .prepare(
        `SELECT * FROM tasks WHERE task_type = 'classify' AND status = 'pending'
         AND EXISTS (
           SELECT 1 FROM files f WHERE f.hash = tasks.target_hash AND f.is_deleted = 0
         )
         ORDER BY priority DESC, created_at ASC LIMIT 1`
      )
      .get() as TaskItem | undefined;
    return row ? this.toQueueItem(row) : null;
  }

  private toQueueItem(task: TaskItem): QueueItem {
    return {
      id: task.id,
      hash: task.target_hash,
      status: task.status,
      priority: task.priority,
      added_at: task.created_at,
      started_at: task.started_at,
      completed_at: task.completed_at,
      error: task.error,
      retries: task.attempts,
    };
  }

  /**
   * Get queue status summary, overall and per task type.
   */
  getQueueStatus(): QueueStatus {
    const stmt = this.db.prepare(`
      SELECT task_type, status, COUNT(*) as count FROM tasks
      WHERE NOT EXISTS (
        SELECT 1 FROM files f WHERE f.hash = tasks.target_hash AND f.is_deleted = 1
      )
      GROUP BY task_type, status
    `);
    const rows = stmt.all() as { task_type: string; status: string; count: number }[];

    const emptySummary = (): TaskStatusSummary => ({
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
    });

    const status: QueueStatus = { ...emptySummary(), byType: {} };
    for (const row of rows) {
      const summary = status.byType[row.task_type] ?? emptySummary();
      if (row.status in summary && row.status !== 'total') {
        summary[row.status as keyof TaskStatusSummary] = row.count;
      }
      summary.total += row.count;
      status.byType[row.task_type] = summary;

      if (row.status in status && row.status !== 'total' && row.status !== 'byType') {
        status[row.status as keyof TaskStatusSummary] += row.count;
      }
      status.total += row.count;
    }

    return status;
  }

  /**
   * Get pending classification tasks (legacy).
   */
  getPendingTasks(limit: number = 10): QueueItem[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM tasks WHERE task_type = 'classify' AND status = 'pending'
         AND EXISTS (
           SELECT 1 FROM files f WHERE f.hash = tasks.target_hash AND f.is_deleted = 0
         )
         ORDER BY priority DESC, created_at ASC LIMIT ?`
      )
      .all(limit) as TaskItem[];
    return rows.map((row) => this.toQueueItem(row));
  }

  /**
   * Get failed tasks, optionally filtered by type.
   */
  getFailedTasks(taskType?: TaskType): QueueItem[] {
    const rows = taskType
      ? (this.db
          .prepare(
            `SELECT * FROM tasks WHERE status = 'failed' AND task_type = ?
             ORDER BY created_at ASC`
          )
          .all(taskType) as TaskItem[])
      : (this.db
          .prepare(`SELECT * FROM tasks WHERE status = 'failed' ORDER BY created_at ASC`)
          .all() as TaskItem[]);
    return rows.map((row) => this.toQueueItem(row));
  }

  /**
   * Retry failed tasks, optionally filtered by type. Failed tasks for
   * ineligible media become skipped instead of pending.
   */
  retryFailedTasks(params: RetryFailedParams = {}): number {
    const { taskType } = params;
    const ineligible = this.normalizeMimeTypes(params.ineligibleMimeTypes);
    const skipError = params.skipError ?? SKIPPED_MEDIA_ERROR;
    const now = new Date().toISOString();

    const transaction = this.db.transaction(() => {
      if (ineligible.length > 0) {
        this.markIneligibleTasksSkipped({
          mimeTypes: ineligible,
          statuses: ['failed'],
          taskType,
          error: skipError,
          now,
        });
      }

      const typeFilter = taskType ? 'AND task_type = ?' : '';
      const eligibleFilter =
        ineligible.length > 0
          ? `AND target_hash NOT IN (${this.ineligibleHashSubquery(ineligible)})`
          : '';
      const stmt = this.db.prepare(`
        UPDATE tasks SET status = 'pending', attempts = 0, next_run_at = NULL, error = NULL,
          started_at = NULL, updated_at = ?
        WHERE status = 'failed' ${typeFilter} ${eligibleFilter}
      `);
      return stmt.run(now, ...(taskType ? [taskType] : []), ...ineligible).changes;
    });
    return transaction();
  }

  private normalizeMimeTypes(mimeTypes?: string[]): string[] {
    if (!mimeTypes || mimeTypes.length === 0) return [];
    return [
      ...new Set(
        mimeTypes.map((mimeType) => mimeType.split(';', 1)[0].trim().toLowerCase()).filter(Boolean)
      ),
    ];
  }

  private ineligibleHashSubquery(mimeTypes: string[]): string {
    return `SELECT hash FROM files WHERE mime_type IN (${mimeTypes.map(() => '?').join(', ')})`;
  }

  private markIneligibleTasksSkipped(params: {
    mimeTypes: string[];
    statuses: string[];
    taskType?: TaskType;
    taskTypes?: TaskType[];
    error: string;
    now: string;
  }): number {
    const { mimeTypes, statuses, taskType, taskTypes, error, now } = params;
    if (mimeTypes.length === 0 || statuses.length === 0) return 0;

    const typeList = taskTypes ?? (taskType ? [taskType] : []);
    const typeFilter =
      typeList.length > 0 ? `AND task_type IN (${typeList.map(() => '?').join(', ')})` : '';
    const statusPlaceholders = statuses.map(() => '?').join(', ');
    const stmt = this.db.prepare(`
      UPDATE tasks
      SET status = 'skipped', error = ?, next_run_at = NULL, started_at = NULL, updated_at = ?
      WHERE status IN (${statusPlaceholders})
        ${typeFilter}
        AND target_hash IN (${this.ineligibleHashSubquery(mimeTypes)})
    `);
    return stmt.run(error, now, ...statuses, ...typeList, ...mimeTypes).changes;
  }

  /**
   * Clear tasks, optionally filtered by type.
   */
  clearQueue(taskType?: TaskType): void {
    if (taskType) {
      this.db.prepare('DELETE FROM tasks WHERE task_type = ?').run(taskType);
    } else {
      this.db.exec('DELETE FROM tasks');
    }
  }

  /**
   * Clear index: delete all tasks, files, and the tag vocabulary.
   */
  clearIndex(): { success: boolean } {
    const transaction = this.db.transaction(() => {
      this.db.exec('DELETE FROM tasks');
      this.db.exec('DELETE FROM tag_aliases');
      this.db.exec('DELETE FROM tags');
      this.db.exec('DELETE FROM files');
    });
    transaction();
    return { success: true };
  }

  /* ----------------------------------------------------------------------- */
  /* Tag vocabulary                                                           */
  /* ----------------------------------------------------------------------- */

  /**
   * List vocabulary tags ordered by pinned state and usage.
   */
  listTags(options: { limit?: number; pinnedOnly?: boolean } = {}): TagRecord[] {
    const clauses: string[] = [];
    if (options.pinnedOnly) clauses.push('is_pinned = 1');
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = options.limit ?? 500;
    return this.db
      .prepare(
        `SELECT * FROM tags ${where}
         ORDER BY is_pinned DESC, usage_count DESC, name ASC LIMIT ?`
      )
      .all(limit) as TagRecord[];
  }

  /**
   * Get a single tag by id.
   */
  getTag(id: number): TagRecord | null {
    const row = this.db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as TagRecord | undefined;
    return row ?? null;
  }

  /**
   * Get a tag by canonical name (case-insensitive).
   */
  getTagByName(name: string): TagRecord | null {
    const row = this.db.prepare('SELECT * FROM tags WHERE name = ? COLLATE NOCASE').get(name) as
      | TagRecord
      | undefined;
    return row ?? null;
  }

  /**
   * Names of the most relevant tags for the classification prompt window.
   */
  getTagVocabulary(limit: number = 40): string[] {
    const rows = this.db
      .prepare(
        `SELECT name FROM tags
         ORDER BY is_pinned DESC, usage_count DESC, name ASC LIMIT ?`
      )
      .all(limit) as Array<{ name: string }>;
    return rows.map((row) => row.name);
  }

  /**
   * Resolve a candidate tag through the alias cache and existing vocabulary.
   * Returns the canonical tag name, or null when the candidate is unknown.
   */
  resolveTagName(candidate: string): string | null {
    const normalized = normalizeTagName(candidate);
    if (!normalized) return null;

    const alias = this.db
      .prepare('SELECT tag_id FROM tag_aliases WHERE alias = ?')
      .get(normalized) as { tag_id: number } | undefined;
    if (alias) {
      const tag = this.getTag(alias.tag_id);
      if (tag) return tag.name;
    }

    const existing = this.getTagByName(normalized);
    return existing ? existing.name : null;
  }

  /**
   * Apply a classification result: resolve/create canonical tags, record
   * aliases, replace content tags on the file (preserving `system:*`), and
   * write classification metadata. Category is intentionally never written.
   */
  applyClassification(params: ApplyClassificationParams): { tags: string[] } {
    const file = this.getFile(params.hash);
    if (!file) {
      throw new Error(`File not found: ${params.hash}`);
    }

    const now = params.classifiedAt ?? new Date().toISOString();
    const systemTags = parseTagList(file.tags).filter((tag) => tag.startsWith('system:'));
    const canonical: string[] = [];

    const transaction = this.db.transaction(() => {
      if (params.aliases) {
        for (const [aliasRaw, canonicalRaw] of Object.entries(params.aliases)) {
          const alias = normalizeTagName(aliasRaw);
          const canonicalName = normalizeTagName(canonicalRaw);
          if (!alias || !canonicalName) continue;
          const tag = this.ensureTag(canonicalName, 'ai');
          this.db
            .prepare(
              `INSERT INTO tag_aliases (alias, tag_id, created_at) VALUES (?, ?, ?)
               ON CONFLICT(alias) DO UPDATE SET tag_id = excluded.tag_id`
            )
            .run(alias, tag.id, now);
        }
      }

      for (const raw of params.tags) {
        const normalized = normalizeTagName(raw);
        if (!normalized) continue;
        const tag = this.resolveOrCreateTag(normalized);
        if (!canonical.includes(tag.name)) {
          canonical.push(tag.name);
        }
      }

      const merged = [...new Set([...systemTags, ...canonical])];
      const fields: string[] = ['tags = ?', 'updated_at = ?'];
      const values: unknown[] = [merged.length > 0 ? JSON.stringify(merged) : null, now];
      if (params.confidence !== undefined) {
        fields.push('confidence = ?');
        values.push(params.confidence);
      }
      if (params.modelUsed !== undefined) {
        fields.push('model_used = ?');
        values.push(params.modelUsed);
      }
      fields.push('classified_at = ?');
      values.push(now);
      values.push(params.hash);

      this.db.prepare(`UPDATE files SET ${fields.join(', ')} WHERE hash = ?`).run(...values);

      this.recomputeTagUsage();
    });
    transaction();

    return { tags: canonical };
  }

  /**
   * Rename a tag, rewriting file associations and preserving the old name as
   * an alias.
   */
  renameTag(params: { id: number; name: string; label?: string }): TagRecord {
    const tag = this.getTag(params.id);
    if (!tag) throw new Error(`Tag not found: ${params.id}`);

    const nextName = normalizeTagName(params.name);
    if (!nextName) throw new Error('Tag name cannot be empty');

    const conflict = this.getTagByName(nextName);
    if (conflict && conflict.id !== tag.id) {
      throw new Error(`Tag already exists: ${nextName}`);
    }

    const now = new Date().toISOString();
    const label = params.label ?? nextName;
    const transaction = this.db.transaction(() => {
      this.db
        .prepare('UPDATE tags SET name = ?, label = ?, updated_at = ? WHERE id = ?')
        .run(nextName, label, now, tag.id);
      this.replaceFileTagName(tag.name, nextName, now);
      this.db
        .prepare(
          `INSERT INTO tag_aliases (alias, tag_id, created_at) VALUES (?, ?, ?)
           ON CONFLICT(alias) DO NOTHING`
        )
        .run(normalizeTagName(tag.name), tag.id, now);
      this.recomputeTagUsage();
    });
    transaction();

    return this.getTag(tag.id)!;
  }

  /**
   * Merge `sourceId` into `targetId`, reassigning files and aliases.
   */
  mergeTags(sourceId: number, targetId: number): TagRecord {
    if (sourceId === targetId) throw new Error('Cannot merge a tag into itself');
    const source = this.getTag(sourceId);
    const target = this.getTag(targetId);
    if (!source) throw new Error(`Tag not found: ${sourceId}`);
    if (!target) throw new Error(`Tag not found: ${targetId}`);

    const now = new Date().toISOString();
    const transaction = this.db.transaction(() => {
      this.replaceFileTagName(source.name, target.name, now);
      this.db
        .prepare('UPDATE OR REPLACE tag_aliases SET tag_id = ? WHERE tag_id = ?')
        .run(target.id, source.id);
      this.db
        .prepare(
          `INSERT INTO tag_aliases (alias, tag_id, created_at) VALUES (?, ?, ?)
           ON CONFLICT(alias) DO UPDATE SET tag_id = excluded.tag_id`
        )
        .run(normalizeTagName(source.name), target.id, now);
      this.db.prepare('DELETE FROM tags WHERE id = ?').run(source.id);
      this.recomputeTagUsage();
    });
    transaction();

    return this.getTag(target.id)!;
  }

  /**
   * Delete a tag and remove it from all file tag lists.
   */
  deleteTag(id: number): boolean {
    const tag = this.getTag(id);
    if (!tag) return false;

    const now = new Date().toISOString();
    const transaction = this.db.transaction(() => {
      const rows = this.db
        .prepare('SELECT hash, tags FROM files WHERE tags IS NOT NULL')
        .all() as Array<{ hash: string; tags: string | null }>;
      const update = this.db.prepare('UPDATE files SET tags = ?, updated_at = ? WHERE hash = ?');
      for (const row of rows) {
        const tags = parseTagList(row.tags);
        const next = tags.filter((t) => t.toLowerCase() !== tag.name.toLowerCase());
        if (next.length !== tags.length) {
          update.run(next.length > 0 ? JSON.stringify(next) : null, now, row.hash);
        }
      }
      this.db.prepare('DELETE FROM tags WHERE id = ?').run(id);
      this.recomputeTagUsage();
    });
    transaction();
    return true;
  }

  /**
   * Toggle a tag's pinned state for Side Panel tab visibility.
   */
  setTagPinned(id: number, pinned: boolean): TagRecord | null {
    const now = new Date().toISOString();
    const result = this.db
      .prepare('UPDATE tags SET is_pinned = ?, updated_at = ? WHERE id = ?')
      .run(pinned ? 1 : 0, now, id);
    if (result.changes === 0) return null;
    return this.getTag(id);
  }

  /**
   * Ensure a tag row exists, creating it with `createdBy` when missing.
   */
  private ensureTag(name: string, createdBy: 'ai' | 'user'): TagRecord {
    const normalized = normalizeTagName(name);
    const existing = this.getTagByName(normalized);
    if (existing) return existing;

    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO tags (name, label, usage_count, created_by, is_pinned, created_at, updated_at)
         VALUES (?, ?, 0, ?, 0, ?, ?)
         ON CONFLICT(name) DO NOTHING`
      )
      .run(normalized, normalized, createdBy, now, now);
    return this.getTagByName(normalized)!;
  }

  private resolveOrCreateTag(normalized: string): TagRecord {
    const alias = this.db
      .prepare('SELECT tag_id FROM tag_aliases WHERE alias = ?')
      .get(normalized) as { tag_id: number } | undefined;
    if (alias) {
      const tag = this.getTag(alias.tag_id);
      if (tag) return tag;
    }
    return this.ensureTag(normalized, 'ai');
  }

  private replaceFileTagName(oldName: string, newName: string, now: string): void {
    const oldKey = oldName.toLowerCase();
    const rows = this.db
      .prepare('SELECT hash, tags FROM files WHERE tags IS NOT NULL')
      .all() as Array<{ hash: string; tags: string | null }>;
    const update = this.db.prepare('UPDATE files SET tags = ?, updated_at = ? WHERE hash = ?');

    for (const row of rows) {
      const tags = parseTagList(row.tags);
      let changed = false;
      const next = tags.map((tag) => {
        if (tag.toLowerCase() === oldKey) {
          changed = true;
          return newName;
        }
        return tag;
      });
      if (!changed) continue;
      update.run(JSON.stringify([...new Set(next)]), now, row.hash);
    }
  }

  /**
   * Recompute `usage_count` for every vocabulary tag from file tag lists.
   */
  recomputeTagUsage(): void {
    const rows = this.db
      .prepare('SELECT tags FROM files WHERE is_deleted = 0 AND tags IS NOT NULL')
      .all() as Array<{ tags: string | null }>;

    const counts = new Map<string, number>();
    for (const row of rows) {
      for (const tag of parseTagList(row.tags)) {
        if (tag.startsWith('system:')) continue;
        const key = tag.toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const tags = this.db.prepare('SELECT id, name FROM tags').all() as Array<{
      id: number;
      name: string;
    }>;
    const update = this.db.prepare('UPDATE tags SET usage_count = ? WHERE id = ?');
    for (const tag of tags) {
      update.run(counts.get(tag.name.toLowerCase()) ?? 0, tag.id);
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database path
   */
  getDbPath(): string {
    return this.dbPath;
  }
}

/**
 * Ensure workspace directory exists
 */
export function ensureWorkspace(workspacePath: string): void {
  const blobsPath = path.join(workspacePath, 'blobs');
  const thumbnailsPath = path.join(workspacePath, 'thumbnails');

  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath, { recursive: true, mode: 0o755 });
  }
  if (!fs.existsSync(blobsPath)) {
    fs.mkdirSync(blobsPath, { recursive: true, mode: 0o755 });
  }
  if (!fs.existsSync(thumbnailsPath)) {
    fs.mkdirSync(thumbnailsPath, { recursive: true, mode: 0o755 });
  }
}
