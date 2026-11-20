"use strict";
/**
 * VFS Service - SQLite Database Module
 *
 * Manages the SQLite index for file metadata and classification queue.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteDatabase = void 0;
exports.normalizeTagName = normalizeTagName;
exports.ensureWorkspace = ensureWorkspace;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const MAX_TAG_NAME_LENGTH = 40;
/**
 * Normalize a tag candidate into a canonical vocabulary key.
 * Lowercases, strips a leading `NEW:` marker, collapses whitespace and
 * truncates overly long names.
 */
function normalizeTagName(raw) {
    return raw
        .trim()
        .replace(/^new\s*[:：]\s*/i, '')
        .replace(/^#+/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .slice(0, MAX_TAG_NAME_LENGTH);
}
function parseTagList(raw) {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.filter((tag) => typeof tag === 'string')
            : [];
    }
    catch {
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
 * Build an actionable error for databases SQLite refuses to open.
 *
 * `SQLITE_CANTOPEN` ("unable to open database file") is what SQLite reports
 * when the workspace volume cannot provide the shared-memory files WAL needs,
 * which is typical for network shares (SMB/NFS) and some removable media.
 */
function databaseOpenError(dbPath, error) {
    const reason = error instanceof Error ? error.message : String(error);
    return new Error(`Unable to open workspace database at ${dbPath}: ${reason}. ` +
        'If the workspace lives on a network share or removable disk, copy vfs.db to a local ' +
        'disk, run `PRAGMA journal_mode = DELETE;` there, and copy it back (WAL journaling ' +
        'requires shared memory that those volumes do not provide).');
}
/**
 * SQLiteDatabase class
 */
class SQLiteDatabase {
    db;
    dbPath;
    constructor(workspacePath) {
        this.dbPath = path_1.default.join(workspacePath, 'vfs.db');
        try {
            this.db = new better_sqlite3_1.default(this.dbPath);
        }
        catch (error) {
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
    configureJournalMode() {
        let mode;
        try {
            mode = this.db.pragma('journal_mode = WAL', { simple: true });
        }
        catch (error) {
            try {
                this.db.close();
            }
            catch {
                // Ignore close errors: the connection is already unusable.
            }
            throw databaseOpenError(this.dbPath, error);
        }
        if (mode !== 'wal') {
            console.warn(`[VFS] WAL journaling unavailable for ${this.dbPath}; using "${mode}" journal mode. ` +
                'This is expected on network shares and some removable disks.');
        }
    }
    /**
     * Initialize database schema
     */
    initializeSchema() {
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
    backfillTagVocabulary() {
        const count = this.db.prepare('SELECT COUNT(*) as count FROM tags').get();
        if (count.count > 0)
            return;
        const rows = this.db.prepare('SELECT tags FROM files WHERE tags IS NOT NULL').all();
        const seen = new Set();
        const transaction = this.db.transaction(() => {
            for (const row of rows) {
                for (const tag of parseTagList(row.tags)) {
                    if (tag.startsWith('system:'))
                        continue;
                    const normalized = normalizeTagName(tag);
                    if (!normalized || seen.has(normalized))
                        continue;
                    seen.add(normalized);
                    this.ensureTag(normalized, 'user');
                }
            }
            if (seen.size > 0)
                this.recomputeTagUsage();
        });
        transaction();
    }
    /**
     * Migrate the legacy `classify_queue` table into the unified `tasks` table.
     * The old table is dropped once its rows have been copied.
     */
    migrateClassifyQueue() {
        const table = this.db
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'classify_queue'")
            .get();
        if (!table)
            return;
        const columns = this.db.prepare('PRAGMA table_info(classify_queue)').all();
        const has = (column) => columns.some((c) => c.name === column);
        const retriesExpr = has('retries') ? 'COALESCE(retries, 0)' : '0';
        const addedAtExpr = has('added_at') ? 'added_at' : "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
        const migrate = this.db.transaction(() => {
            this.db
                .prepare(`
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
        `)
                .run();
            this.db.exec('DROP TABLE classify_queue');
        });
        migrate();
    }
    /**
     * Insert a new file record
     */
    insertFile(metadata) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO files (
        hash, blob_ext, mime_type, size, source_url, captured_at,
        category, ai_filename, tags, confidence, classified_at, model_used,
        is_starred, user_notes, is_deleted, deleted_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(metadata.hash, metadata.blob_ext, metadata.mime_type, metadata.size, metadata.source_url, metadata.captured_at, metadata.category, metadata.ai_filename, metadata.tags, metadata.confidence, metadata.classified_at, metadata.model_used, metadata.is_starred, metadata.user_notes, metadata.is_deleted, metadata.deleted_at, now, now);
    }
    /**
     * Get file metadata by hash
     */
    getFile(hash) {
        const stmt = this.db.prepare('SELECT * FROM files WHERE hash = ?');
        const row = stmt.get(hash);
        return row || null;
    }
    /**
     * Check if file exists by hash
     */
    fileExists(hash) {
        const stmt = this.db.prepare('SELECT 1 FROM files WHERE hash = ?');
        return stmt.get(hash) !== undefined;
    }
    /**
     * Update file metadata
     */
    updateMetadata(hash, updates) {
        const file = this.getFile(hash);
        if (!file)
            return false;
        const now = new Date().toISOString();
        const updateFields = [];
        const updateValues = [];
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
            let tags = [];
            if (file.tags) {
                try {
                    const parsedTags = JSON.parse(file.tags);
                    if (Array.isArray(parsedTags)) {
                        tags = parsedTags;
                    }
                }
                catch {
                    // ignore
                }
            }
            if (updates.is_starred) {
                if (!tags.includes('system:starred')) {
                    tags.push('system:starred');
                }
            }
            else {
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
        if (updateFields.length === 0)
            return false;
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
    softDeleteFile(hash) {
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
    hardDeleteFile(hash) {
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
    restoreFile(hash) {
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
    listFiles(query) {
        const limit = query.limit ?? 50;
        const offset = query.offset ?? 0;
        const orderBy = query.orderBy ?? 'captured_at';
        const order = query.order ?? 'desc';
        const includeDeleted = query.includeDeleted ?? false;
        let whereClause = includeDeleted ? '' : 'WHERE is_deleted = 0';
        const whereValues = [];
        if (query.category) {
            whereClause = includeDeleted ? 'WHERE category = ?' : 'WHERE is_deleted = 0 AND category = ?';
            whereValues.push(query.category);
        }
        else if (query.tag) {
            // Tag filtering - unified logic
            const tag = query.tag;
            if (tag === 'all') {
                // No filter needed
            }
            else if (tag === 'uncategorized') {
                // Files without any user tags (tags is null/empty, or no tags without "system:" prefix)
                whereClause = includeDeleted
                    ? `WHERE (tags IS NULL OR tags = '[]' OR NOT EXISTS (
              SELECT 1 FROM json_each(tags) WHERE json_each.value NOT LIKE 'system:%'
            ))`
                    : `WHERE is_deleted = 0 AND (tags IS NULL OR tags = '[]' OR NOT EXISTS (
              SELECT 1 FROM json_each(tags) WHERE json_each.value NOT LIKE 'system:%'
            ))`;
            }
            else {
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
        const countResult = countStmt.get(...whereValues);
        const total = countResult.count;
        // Query items
        const itemsStmt = this.db.prepare(`
      SELECT * FROM files ${whereClause}
      ORDER BY ${orderBy} ${order === 'desc' ? 'DESC' : 'ASC'}
      LIMIT ? OFFSET ?
    `);
        const items = itemsStmt.all(...whereValues, limit, offset);
        return {
            items,
            total,
            hasMore: offset + limit < total,
        };
    }
    /**
     * List files strictly after a keyset cursor, ordered by `(created_at, hash)`.
     * Used by incremental consumers such as the media archive worker.
     */
    listFilesCreatedAfter(params) {
        const limit = Math.max(1, Math.floor(params.limit ?? 200));
        const stmt = this.db.prepare(`
      SELECT * FROM files
      WHERE is_deleted = 0
        AND (created_at > ? OR (created_at = ? AND hash > ?))
      ORDER BY created_at ASC, hash ASC
      LIMIT ?
    `);
        return stmt.all(params.createdAt, params.createdAt, params.hash, limit);
    }
    /**
     * Get tag usage counts
     */
    getTagCounts() {
        const counts = {};
        // Aggregate totals and system tags directly in SQL instead of loading
        // every file row into JS and JSON.parsing each tags field.
        const totals = this.db
            .prepare(`
        SELECT
          COUNT(*) AS all_count,
          COALESCE(SUM(CASE WHEN mime_type LIKE 'image/%' THEN 1 ELSE 0 END), 0) AS image,
          COALESCE(SUM(CASE WHEN mime_type LIKE 'video/%' THEN 1 ELSE 0 END), 0) AS video,
          COALESCE(SUM(CASE WHEN is_starred = 1 THEN 1 ELSE 0 END), 0) AS starred
        FROM files WHERE is_deleted = 0
      `)
            .get();
        counts.all = totals.all_count;
        if (totals.image)
            counts.image = totals.image;
        if (totals.video)
            counts.video = totals.video;
        if (totals.starred)
            counts.starred = totals.starred;
        // User tags (non-system) via SQLite's json_each.
        const tagRows = this.db
            .prepare(`
        SELECT json_each.value AS tag, COUNT(*) AS count
        FROM files, json_each(files.tags)
        WHERE files.is_deleted = 0
          AND json_each.type = 'text'
          AND json_each.value NOT LIKE 'system:%'
        GROUP BY json_each.value
      `)
            .all();
        for (const row of tagRows) {
            counts[row.tag] = (counts[row.tag] || 0) + row.count;
        }
        // Files with no user tags.
        const uncategorizedRow = this.db
            .prepare(`
        SELECT COUNT(*) AS count
        FROM files
        WHERE is_deleted = 0
          AND NOT EXISTS (
            SELECT 1 FROM json_each(files.tags)
            WHERE json_each.type = 'text' AND json_each.value NOT LIKE 'system:%'
          )
      `)
            .get();
        if (uncategorizedRow.count)
            counts.uncategorized = uncategorizedRow.count;
        return counts;
    }
    /**
     * Get statistics
     */
    getStats() {
        // Total and size
        const totalStmt = this.db.prepare(`
      SELECT COUNT(*) as count, SUM(size) as total_size
      FROM files WHERE is_deleted = 0
    `);
        const totalResult = totalStmt.get();
        // Images vs videos
        const imagesStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM files
      WHERE is_deleted = 0 AND mime_type LIKE 'image/%'
    `);
        const imagesResult = imagesStmt.get();
        const videosStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM files
      WHERE is_deleted = 0 AND mime_type LIKE 'video/%'
    `);
        const videosResult = videosStmt.get();
        // By category
        const categoryStmt = this.db.prepare(`
      SELECT category, COUNT(*) as count FROM files
      WHERE is_deleted = 0
      GROUP BY category
    `);
        const categoryRows = categoryStmt.all();
        const byCategory = {};
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
    enqueueTask(params) {
        const { taskType, hash, priority = 5, maxAttempts = 3, requeue = false } = params;
        if (!this.fileExists(hash))
            return false;
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
    enqueueClassification(hash, priority = 5) {
        return this.enqueueTask({ taskType: 'classify', hash, priority, requeue: true });
    }
    /**
     * Atomically claim up to `limit` due tasks for processing.
     */
    claimTasks(limit, taskTypes) {
        if (limit <= 0)
            return [];
        const now = new Date().toISOString();
        const typeFilter = taskTypes && taskTypes.length > 0
            ? `AND task_type IN (${taskTypes.map(() => '?').join(', ')})`
            : '';
        const selectStmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE status = 'pending' AND (next_run_at IS NULL OR next_run_at <= ?) ${typeFilter}
      ORDER BY priority DESC, created_at ASC
      LIMIT ?
    `);
        const updateStmt = this.db.prepare(`
      UPDATE tasks
      SET status = 'processing', started_at = ?, updated_at = ?, error = NULL
      WHERE id = ? AND status = 'pending'
    `);
        const claimed = [];
        const transaction = this.db.transaction(() => {
            const rows = selectStmt.all(now, ...(taskTypes ?? []), limit);
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
    updateTaskStatus(paramsOrHash, status, error) {
        const now = new Date().toISOString();
        // Legacy classification-only signature: `failed` is terminal, no backoff.
        if (typeof paramsOrHash === 'string') {
            const nextStatus = status ?? 'pending';
            if (nextStatus === 'processing') {
                this.db
                    .prepare(`UPDATE tasks SET status = 'processing', started_at = ?, updated_at = ?, error = NULL
             WHERE task_type = 'classify' AND target_hash = ?`)
                    .run(now, now, paramsOrHash);
            }
            else if (nextStatus === 'completed') {
                this.db
                    .prepare(`UPDATE tasks SET status = 'completed', completed_at = ?, updated_at = ?, error = NULL
             WHERE task_type = 'classify' AND target_hash = ?`)
                    .run(now, now, paramsOrHash);
            }
            else if (nextStatus === 'failed') {
                this.db
                    .prepare(`UPDATE tasks SET status = 'failed', error = ?, attempts = attempts + 1, updated_at = ?
             WHERE task_type = 'classify' AND target_hash = ?`)
                    .run(error ?? 'Unknown error', now, paramsOrHash);
            }
            else {
                this.db
                    .prepare(`UPDATE tasks SET status = 'pending', next_run_at = NULL, started_at = NULL,
               error = NULL, updated_at = ?
             WHERE task_type = 'classify' AND target_hash = ?`)
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
    requeueTask(taskType, hash) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      UPDATE tasks
      SET status = 'pending', attempts = 0, next_run_at = NULL, started_at = NULL,
          completed_at = NULL, error = NULL, updated_at = ?
      WHERE task_type = ? AND target_hash = ?
    `);
        if (stmt.run(now, taskType, hash).changes > 0)
            return true;
        return this.enqueueTask({ taskType, hash, requeue: true });
    }
    /**
     * Requeue every task of a type (full rescan), creating rows for files that
     * never had that task type. When `taskType` is omitted all existing task
     * types are requeued.
     */
    requeueAll(taskType) {
        const now = new Date().toISOString();
        if (taskType) {
            const transaction = this.db.transaction(() => {
                this.db
                    .prepare(`INSERT INTO tasks (
               task_type, target_hash, status, priority, attempts, max_attempts,
               next_run_at, started_at, completed_at, error, created_at, updated_at
             )
             SELECT ?, hash, 'pending', 5, 0, 3, NULL, NULL, NULL, NULL, ?, ?
             FROM files WHERE is_deleted = 0
             ON CONFLICT(task_type, target_hash) DO NOTHING`)
                    .run(taskType, now, now);
                return this.db
                    .prepare(`UPDATE tasks
             SET status = 'pending', attempts = 0, next_run_at = NULL, started_at = NULL,
                 completed_at = NULL, error = NULL, updated_at = ?
             WHERE task_type = ?`)
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
    recoverStaleProcessingTasks() {
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
    getTasksByHash(hash) {
        const stmt = this.db.prepare('SELECT * FROM tasks WHERE target_hash = ? ORDER BY task_type');
        return stmt.all(hash);
    }
    /**
     * Get next pending classification task (legacy).
     */
    getNextPendingTask() {
        const row = this.db
            .prepare(`SELECT * FROM tasks WHERE task_type = 'classify' AND status = 'pending'
         ORDER BY priority DESC, created_at ASC LIMIT 1`)
            .get();
        return row ? this.toQueueItem(row) : null;
    }
    toQueueItem(task) {
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
    getQueueStatus() {
        const stmt = this.db.prepare(`
      SELECT task_type, status, COUNT(*) as count FROM tasks GROUP BY task_type, status
    `);
        const rows = stmt.all();
        const emptySummary = () => ({
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            total: 0,
        });
        const status = { ...emptySummary(), byType: {} };
        for (const row of rows) {
            const summary = status.byType[row.task_type] ?? emptySummary();
            if (row.status in summary && row.status !== 'total') {
                summary[row.status] = row.count;
            }
            summary.total += row.count;
            status.byType[row.task_type] = summary;
            if (row.status in status && row.status !== 'total' && row.status !== 'byType') {
                status[row.status] = row.count;
            }
            status.total += row.count;
        }
        return status;
    }
    /**
     * Get pending classification tasks (legacy).
     */
    getPendingTasks(limit = 10) {
        const rows = this.db
            .prepare(`SELECT * FROM tasks WHERE task_type = 'classify' AND status = 'pending'
         ORDER BY priority DESC, created_at ASC LIMIT ?`)
            .all(limit);
        return rows.map((row) => this.toQueueItem(row));
    }
    /**
     * Get failed tasks, optionally filtered by type.
     */
    getFailedTasks(taskType) {
        const rows = taskType
            ? this.db
                .prepare(`SELECT * FROM tasks WHERE status = 'failed' AND task_type = ?
             ORDER BY created_at ASC`)
                .all(taskType)
            : this.db
                .prepare(`SELECT * FROM tasks WHERE status = 'failed' ORDER BY created_at ASC`)
                .all();
        return rows.map((row) => this.toQueueItem(row));
    }
    /**
     * Retry failed tasks, optionally filtered by type.
     */
    retryFailedTasks(taskType) {
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
    clearQueue(taskType) {
        if (taskType) {
            this.db.prepare('DELETE FROM tasks WHERE task_type = ?').run(taskType);
        }
        else {
            this.db.exec('DELETE FROM tasks');
        }
    }
    /**
     * Clear index: delete all tasks, files, and the tag vocabulary.
     */
    clearIndex() {
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
    listTags(options = {}) {
        const clauses = [];
        if (options.pinnedOnly)
            clauses.push('is_pinned = 1');
        const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
        const limit = options.limit ?? 500;
        return this.db
            .prepare(`SELECT * FROM tags ${where}
         ORDER BY is_pinned DESC, usage_count DESC, name ASC LIMIT ?`)
            .all(limit);
    }
    /**
     * Get a single tag by id.
     */
    getTag(id) {
        const row = this.db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
        return row ?? null;
    }
    /**
     * Get a tag by canonical name (case-insensitive).
     */
    getTagByName(name) {
        const row = this.db.prepare('SELECT * FROM tags WHERE name = ? COLLATE NOCASE').get(name);
        return row ?? null;
    }
    /**
     * Names of the most relevant tags for the classification prompt window.
     */
    getTagVocabulary(limit = 40) {
        const rows = this.db
            .prepare(`SELECT name FROM tags
         ORDER BY is_pinned DESC, usage_count DESC, name ASC LIMIT ?`)
            .all(limit);
        return rows.map((row) => row.name);
    }
    /**
     * Resolve a candidate tag through the alias cache and existing vocabulary.
     * Returns the canonical tag name, or null when the candidate is unknown.
     */
    resolveTagName(candidate) {
        const normalized = normalizeTagName(candidate);
        if (!normalized)
            return null;
        const alias = this.db
            .prepare('SELECT tag_id FROM tag_aliases WHERE alias = ?')
            .get(normalized);
        if (alias) {
            const tag = this.getTag(alias.tag_id);
            if (tag)
                return tag.name;
        }
        const existing = this.getTagByName(normalized);
        return existing ? existing.name : null;
    }
    /**
     * Apply a classification result: resolve/create canonical tags, record
     * aliases, replace content tags on the file (preserving `system:*`), and
     * write classification metadata. Category is intentionally never written.
     */
    applyClassification(params) {
        const file = this.getFile(params.hash);
        if (!file) {
            throw new Error(`File not found: ${params.hash}`);
        }
        const now = params.classifiedAt ?? new Date().toISOString();
        const systemTags = parseTagList(file.tags).filter((tag) => tag.startsWith('system:'));
        const canonical = [];
        const transaction = this.db.transaction(() => {
            if (params.aliases) {
                for (const [aliasRaw, canonicalRaw] of Object.entries(params.aliases)) {
                    const alias = normalizeTagName(aliasRaw);
                    const canonicalName = normalizeTagName(canonicalRaw);
                    if (!alias || !canonicalName)
                        continue;
                    const tag = this.ensureTag(canonicalName, 'ai');
                    this.db
                        .prepare(`INSERT INTO tag_aliases (alias, tag_id, created_at) VALUES (?, ?, ?)
               ON CONFLICT(alias) DO UPDATE SET tag_id = excluded.tag_id`)
                        .run(alias, tag.id, now);
                }
            }
            for (const raw of params.tags) {
                const normalized = normalizeTagName(raw);
                if (!normalized)
                    continue;
                const tag = this.resolveOrCreateTag(normalized);
                if (!canonical.includes(tag.name)) {
                    canonical.push(tag.name);
                }
            }
            const merged = [...new Set([...systemTags, ...canonical])];
            const fields = ['tags = ?', 'updated_at = ?'];
            const values = [merged.length > 0 ? JSON.stringify(merged) : null, now];
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
    renameTag(params) {
        const tag = this.getTag(params.id);
        if (!tag)
            throw new Error(`Tag not found: ${params.id}`);
        const nextName = normalizeTagName(params.name);
        if (!nextName)
            throw new Error('Tag name cannot be empty');
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
                .prepare(`INSERT INTO tag_aliases (alias, tag_id, created_at) VALUES (?, ?, ?)
           ON CONFLICT(alias) DO NOTHING`)
                .run(normalizeTagName(tag.name), tag.id, now);
            this.recomputeTagUsage();
        });
        transaction();
        return this.getTag(tag.id);
    }
    /**
     * Merge `sourceId` into `targetId`, reassigning files and aliases.
     */
    mergeTags(sourceId, targetId) {
        if (sourceId === targetId)
            throw new Error('Cannot merge a tag into itself');
        const source = this.getTag(sourceId);
        const target = this.getTag(targetId);
        if (!source)
            throw new Error(`Tag not found: ${sourceId}`);
        if (!target)
            throw new Error(`Tag not found: ${targetId}`);
        const now = new Date().toISOString();
        const transaction = this.db.transaction(() => {
            this.replaceFileTagName(source.name, target.name, now);
            this.db
                .prepare('UPDATE OR REPLACE tag_aliases SET tag_id = ? WHERE tag_id = ?')
                .run(target.id, source.id);
            this.db
                .prepare(`INSERT INTO tag_aliases (alias, tag_id, created_at) VALUES (?, ?, ?)
           ON CONFLICT(alias) DO UPDATE SET tag_id = excluded.tag_id`)
                .run(normalizeTagName(source.name), target.id, now);
            this.db.prepare('DELETE FROM tags WHERE id = ?').run(source.id);
            this.recomputeTagUsage();
        });
        transaction();
        return this.getTag(target.id);
    }
    /**
     * Delete a tag and remove it from all file tag lists.
     */
    deleteTag(id) {
        const tag = this.getTag(id);
        if (!tag)
            return false;
        const now = new Date().toISOString();
        const transaction = this.db.transaction(() => {
            const rows = this.db
                .prepare('SELECT hash, tags FROM files WHERE tags IS NOT NULL')
                .all();
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
    setTagPinned(id, pinned) {
        const now = new Date().toISOString();
        const result = this.db
            .prepare('UPDATE tags SET is_pinned = ?, updated_at = ? WHERE id = ?')
            .run(pinned ? 1 : 0, now, id);
        if (result.changes === 0)
            return null;
        return this.getTag(id);
    }
    /**
     * Ensure a tag row exists, creating it with `createdBy` when missing.
     */
    ensureTag(name, createdBy) {
        const normalized = normalizeTagName(name);
        const existing = this.getTagByName(normalized);
        if (existing)
            return existing;
        const now = new Date().toISOString();
        this.db
            .prepare(`INSERT INTO tags (name, label, usage_count, created_by, is_pinned, created_at, updated_at)
         VALUES (?, ?, 0, ?, 0, ?, ?)
         ON CONFLICT(name) DO NOTHING`)
            .run(normalized, normalized, createdBy, now, now);
        return this.getTagByName(normalized);
    }
    resolveOrCreateTag(normalized) {
        const alias = this.db
            .prepare('SELECT tag_id FROM tag_aliases WHERE alias = ?')
            .get(normalized);
        if (alias) {
            const tag = this.getTag(alias.tag_id);
            if (tag)
                return tag;
        }
        return this.ensureTag(normalized, 'ai');
    }
    replaceFileTagName(oldName, newName, now) {
        const oldKey = oldName.toLowerCase();
        const rows = this.db
            .prepare('SELECT hash, tags FROM files WHERE tags IS NOT NULL')
            .all();
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
            if (!changed)
                continue;
            update.run(JSON.stringify([...new Set(next)]), now, row.hash);
        }
    }
    /**
     * Recompute `usage_count` for every vocabulary tag from file tag lists.
     */
    recomputeTagUsage() {
        const rows = this.db
            .prepare('SELECT tags FROM files WHERE is_deleted = 0 AND tags IS NOT NULL')
            .all();
        const counts = new Map();
        for (const row of rows) {
            for (const tag of parseTagList(row.tags)) {
                if (tag.startsWith('system:'))
                    continue;
                const key = tag.toLowerCase();
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        }
        const tags = this.db.prepare('SELECT id, name FROM tags').all();
        const update = this.db.prepare('UPDATE tags SET usage_count = ? WHERE id = ?');
        for (const tag of tags) {
            update.run(counts.get(tag.name.toLowerCase()) ?? 0, tag.id);
        }
    }
    /**
     * Close database connection
     */
    close() {
        this.db.close();
    }
    /**
     * Get database path
     */
    getDbPath() {
        return this.dbPath;
    }
}
exports.SQLiteDatabase = SQLiteDatabase;
/**
 * Ensure workspace directory exists
 */
function ensureWorkspace(workspacePath) {
    const blobsPath = path_1.default.join(workspacePath, 'blobs');
    const thumbnailsPath = path_1.default.join(workspacePath, 'thumbnails');
    if (!fs_1.default.existsSync(workspacePath)) {
        fs_1.default.mkdirSync(workspacePath, { recursive: true, mode: 0o755 });
    }
    if (!fs_1.default.existsSync(blobsPath)) {
        fs_1.default.mkdirSync(blobsPath, { recursive: true, mode: 0o755 });
    }
    if (!fs_1.default.existsSync(thumbnailsPath)) {
        fs_1.default.mkdirSync(thumbnailsPath, { recursive: true, mode: 0o755 });
    }
}
//# sourceMappingURL=sqlite.js.map