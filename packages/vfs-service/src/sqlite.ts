/**
 * VFS Service - SQLite Database Module
 *
 * Manages the SQLite index for file metadata and classification queue.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

const MAX_TAG_NAME_LENGTH = 40;

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

// SQLite schema constants
const FILES_TABLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS files (
    -- Immutable (capture-time)
    hash            TEXT PRIMARY KEY,
    blob_ext        TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    size            INTEGER NOT NULL,
    source_url      TEXT,
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
    is_deleted      INTEGER DEFAULT 0,
    deleted_at      TEXT,

    -- Metadata
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_category ON files(category) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_files_captured_at ON files(captured_at);
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
  captured_at: string;
  category: string;
  ai_filename: string | null;
  tags: string | null; // JSON array
  confidence: number;
  classified_at: string | null;
  model_used: string | null;
  is_starred: number;
  user_notes: string | null;
  is_deleted: number;
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
  status: 'pending' | 'processing' | 'completed' | 'failed';
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

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

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
 * List query parameters
 */
export interface ListQuery {
  category?: string;
  tag?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'captured_at' | 'category' | 'classified_at';
  order?: 'asc' | 'desc';
  includeDeleted?: boolean;
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
}

/**
 * SQLiteDatabase class
 */
export class SQLiteDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(workspacePath: string) {
    this.dbPath = path.join(workspacePath, 'vfs.db');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeSchema();
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    this.db.exec(FILES_TABLE_SCHEMA);
    this.db.exec(TASKS_TABLE_SCHEMA);
    this.db.exec(TAGS_TABLE_SCHEMA);
    this.migrateClassifyQueue();
    this.backfillTagVocabulary();
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
  insertFile(metadata: Omit<FileMetadata, 'created_at' | 'updated_at'>): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO files (
        hash, blob_ext, mime_type, size, source_url, captured_at,
        category, ai_filename, tags, confidence, classified_at, model_used,
        is_starred, user_notes, is_deleted, deleted_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      metadata.hash,
      metadata.blob_ext,
      metadata.mime_type,
      metadata.size,
      metadata.source_url,
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
   * Soft delete file
   */
  softDeleteFile(hash: string): boolean {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE files SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE hash = ?
    `);
    const result = stmt.run(now, now, hash);
    return result.changes > 0;
  }

  /**
   * Hard delete file (remove record)
   */
  hardDeleteFile(hash: string): boolean {
    // First remove any tasks for this hash
    const taskStmt = this.db.prepare('DELETE FROM tasks WHERE target_hash = ?');
    taskStmt.run(hash);

    const stmt = this.db.prepare('DELETE FROM files WHERE hash = ?');
    const result = stmt.run(hash);
    return result.changes > 0;
  }

  /**
   * Restore soft-deleted file
   */
  restoreFile(hash: string): boolean {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE files SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE hash = ?
    `);
    const result = stmt.run(now, hash);
    return result.changes > 0;
  }

  /**
   * List files with pagination and filters
   */
  listFiles(query: ListQuery): { items: FileMetadata[]; total: number; hasMore: boolean } {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const orderBy = query.orderBy ?? 'captured_at';
    const order = query.order ?? 'desc';
    const includeDeleted = query.includeDeleted ?? false;

    let whereClause = includeDeleted ? '' : 'WHERE is_deleted = 0';
    const whereValues: unknown[] = [];

    if (query.category) {
      whereClause = includeDeleted ? 'WHERE category = ?' : 'WHERE is_deleted = 0 AND category = ?';
      whereValues.push(query.category);
    } else if (query.tag) {
      // Tag filtering - unified logic
      const tag = query.tag;
      if (tag === 'all') {
        // No filter needed
      } else if (tag === 'uncategorized') {
        // Files without any user tags (tags is null/empty, or no tags without "system:" prefix)
        whereClause = includeDeleted
          ? `WHERE (tags IS NULL OR tags = '[]' OR NOT EXISTS (
              SELECT 1 FROM json_each(tags) WHERE json_each.value NOT LIKE 'system:%'
            ))`
          : `WHERE is_deleted = 0 AND (tags IS NULL OR tags = '[]' OR NOT EXISTS (
              SELECT 1 FROM json_each(tags) WHERE json_each.value NOT LIKE 'system:%'
            ))`;
      } else {
        // Filter by user tag or system tag (check both tag name and system:tag name)
        whereClause = includeDeleted
          ? `WHERE (
              EXISTS (SELECT 1 FROM json_each(tags) WHERE json_each.value = ?)
              OR EXISTS (SELECT 1 FROM json_each(tags) WHERE json_each.value = ?)
            )`
          : `WHERE is_deleted = 0 AND (
              EXISTS (SELECT 1 FROM json_each(tags) WHERE json_each.value = ?)
              OR EXISTS (SELECT 1 FROM json_each(tags) WHERE json_each.value = ?)
            )`;
        whereValues.push(tag);
        whereValues.push(`system:${tag}`);
      }
    }

    // Count total
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM files ${whereClause}
    `);
    const countResult = countStmt.get(...whereValues) as { count: number };
    const total = countResult.count;

    // Query items
    const itemsStmt = this.db.prepare(`
      SELECT * FROM files ${whereClause}
      ORDER BY ${orderBy} ${order === 'desc' ? 'DESC' : 'ASC'}
      LIMIT ? OFFSET ?
    `);
    const items = itemsStmt.all(...whereValues, limit, offset) as FileMetadata[];

    return {
      items,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get tag usage counts
   */
  getTagCounts(): Record<string, number> {
    const counts: Record<string, number> = { all: 0 };

    // Get all files
    const allStmt = this.db.prepare(`
      SELECT mime_type, tags, is_starred FROM files WHERE is_deleted = 0
    `);
    const rows = allStmt.all() as Array<{
      mime_type: string;
      tags: string | null;
      is_starred: number;
    }>;

    for (const row of rows) {
      counts.all++;

      // User tags and system tags from tags field
      let hasUserTags = false;
      let hasSystemImage = false;
      let hasSystemVideo = false;
      let hasSystemStarred = false;

      if (row.tags) {
        try {
          const tags = JSON.parse(row.tags);
          if (Array.isArray(tags)) {
            for (const tag of tags) {
              if (tag.startsWith('system:')) {
                // System tags - count both with and without prefix
                const tagName = tag.substring(7);
                counts[tagName] = (counts[tagName] || 0) + 1;
                if (tagName === 'image') hasSystemImage = true;
                if (tagName === 'video') hasSystemVideo = true;
                if (tagName === 'starred') hasSystemStarred = true;
              } else {
                // User tags
                hasUserTags = true;
                counts[tag] = (counts[tag] || 0) + 1;
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // Backward compatibility - count based on mime_type and is_starred
      // in case some files don't have system tags yet
      if (row.mime_type.startsWith('image/') && !hasSystemImage) {
        counts.image = (counts.image || 0) + 1;
      } else if (row.mime_type.startsWith('video/') && !hasSystemVideo) {
        counts.video = (counts.video || 0) + 1;
      }
      if (row.is_starred === 1 && !hasSystemStarred) {
        counts.starred = (counts.starred || 0) + 1;
      }

      // Uncategorized
      if (!hasUserTags) {
        counts.uncategorized = (counts.uncategorized || 0) + 1;
      }
    }

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

    return {
      totalFiles: totalResult.count,
      totalSize: totalResult.total_size ?? 0,
      images: imagesResult.count,
      videos: videosResult.count,
      byCategory,
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
  claimTasks(limit: number): TaskItem[] {
    if (limit <= 0) return [];
    const now = new Date().toISOString();
    const selectStmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE status = 'pending' AND (next_run_at IS NULL OR next_run_at <= ?)
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
      const rows = selectStmt.all(now, limit) as TaskItem[];
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
   * Requeue every task of a type (full rescan), creating rows for files that
   * never had that task type. When `taskType` is omitted all existing task
   * types are requeued.
   */
  requeueAll(taskType?: TaskType): number {
    const now = new Date().toISOString();
    if (taskType) {
      const transaction = this.db.transaction(() => {
        this.db
          .prepare(
            `INSERT INTO tasks (
               task_type, target_hash, status, priority, attempts, max_attempts,
               next_run_at, started_at, completed_at, error, created_at, updated_at
             )
             SELECT ?, hash, 'pending', 5, 0, 3, NULL, NULL, NULL, NULL, ?, ?
             FROM files WHERE is_deleted = 0
             ON CONFLICT(task_type, target_hash) DO NOTHING`
          )
          .run(taskType, now, now);
        return this.db
          .prepare(
            `UPDATE tasks
             SET status = 'pending', attempts = 0, next_run_at = NULL, started_at = NULL,
                 completed_at = NULL, error = NULL, updated_at = ?
             WHERE task_type = ?`
          )
          .run(now, taskType).changes;
      });
      return transaction();
    }
    const stmt = this.db.prepare(`
      UPDATE tasks
      SET status = 'pending', attempts = 0, next_run_at = NULL, started_at = NULL,
          completed_at = NULL, error = NULL, updated_at = ?
    `);
    return stmt.run(now).changes;
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
      SELECT task_type, status, COUNT(*) as count FROM tasks GROUP BY task_type, status
    `);
    const rows = stmt.all() as { task_type: string; status: string; count: number }[];

    const emptySummary = (): TaskStatusSummary => ({
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
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
        status[row.status as keyof TaskStatusSummary] = row.count;
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
   * Retry failed tasks, optionally filtered by type.
   */
  retryFailedTasks(taskType?: TaskType): number {
    const now = new Date().toISOString();
    if (taskType) {
      const stmt = this.db.prepare(`
        UPDATE tasks SET status = 'pending', attempts = 0, next_run_at = NULL, error = NULL,
          started_at = NULL, updated_at = ? WHERE status = 'failed' AND task_type = ?
      `);
      return stmt.run(now, taskType).changes;
    }
    const stmt = this.db.prepare(`
      UPDATE tasks SET status = 'pending', attempts = 0, next_run_at = NULL, error = NULL,
        started_at = NULL, updated_at = ? WHERE status = 'failed'
    `);
    return stmt.run(now).changes;
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
 * Get default workspace path
 */
export function getDefaultWorkspacePath(): string {
  return path.join(os.homedir(), '.vfs-workspace');
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
