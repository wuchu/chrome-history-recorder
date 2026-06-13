/**
 * VFS Service - SQLite Database Module
 *
 * Manages the SQLite index for file metadata and classification queue.
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
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
const QUEUE_TABLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS classify_queue (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    hash            TEXT NOT NULL UNIQUE REFERENCES files(hash),
    status          TEXT DEFAULT 'pending',
    priority        INTEGER DEFAULT 5,
    added_at        TEXT NOT NULL,
    started_at      TEXT,
    completed_at    TEXT,
    error           TEXT,
    retries         INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON classify_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_priority ON classify_queue(priority DESC, added_at ASC);
`;
/**
 * SQLiteDatabase class
 */
export class SQLiteDatabase {
    db;
    dbPath;
    constructor(workspacePath) {
        this.dbPath = path.join(workspacePath, 'vfs.db');
        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        this.initializeSchema();
    }
    /**
     * Initialize database schema
     */
    initializeSchema() {
        this.db.exec(FILES_TABLE_SCHEMA);
        this.db.exec(QUEUE_TABLE_SCHEMA);
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
        // First remove from queue if exists
        const queueStmt = this.db.prepare('DELETE FROM classify_queue WHERE hash = ?');
        queueStmt.run(hash);
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
            whereClause = includeDeleted
                ? 'WHERE category = ?'
                : 'WHERE is_deleted = 0 AND category = ?';
            whereValues.push(query.category);
        }
        else if (query.tag) {
            // Tag filtering
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
            else if (tag === 'image' || tag === 'video') {
                // Filter by mime type
                whereClause = includeDeleted
                    ? `WHERE mime_type LIKE ?`
                    : `WHERE is_deleted = 0 AND mime_type LIKE ?`;
                whereValues.push(`${tag}%`);
            }
            else if (tag === 'starred') {
                // Filter by starred
                whereClause = includeDeleted
                    ? `WHERE is_starred = 1`
                    : `WHERE is_deleted = 0 AND is_starred = 1`;
            }
            else {
                // Filter by user tag or system tag (check if tag exists in tags array)
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
     * Get tag usage counts
     */
    getTagCounts() {
        const counts = { all: 0 };
        // Get all files
        const allStmt = this.db.prepare(`
      SELECT mime_type, tags, is_starred FROM files WHERE is_deleted = 0
    `);
        const rows = allStmt.all();
        for (const row of rows) {
            counts.all++;
            // Image/video
            if (row.mime_type.startsWith('image/')) {
                counts.image = (counts.image || 0) + 1;
            }
            else if (row.mime_type.startsWith('video/')) {
                counts.video = (counts.video || 0) + 1;
            }
            // Starred
            if (row.is_starred === 1) {
                counts.starred = (counts.starred || 0) + 1;
            }
            // User tags
            let hasUserTags = false;
            if (row.tags) {
                try {
                    const tags = JSON.parse(row.tags);
                    if (Array.isArray(tags)) {
                        for (const tag of tags) {
                            if (!tag.startsWith('system:')) {
                                hasUserTags = true;
                                counts[tag] = (counts[tag] || 0) + 1;
                            }
                        }
                    }
                }
                catch {
                    // ignore
                }
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
     * Enqueue classification task
     */
    enqueueClassification(hash, priority = 5) {
        if (!this.fileExists(hash))
            return false;
        const now = new Date().toISOString();
        const existingStmt = this.db.prepare('SELECT 1 FROM classify_queue WHERE hash = ?');
        const exists = existingStmt.get(hash) !== undefined;
        if (exists) {
            const updateStmt = this.db.prepare(`
        UPDATE classify_queue
        SET status = 'pending', priority = ?, added_at = ?, started_at = NULL,
            completed_at = NULL, error = NULL, retries = 0
        WHERE hash = ?
      `);
            updateStmt.run(priority, now, hash);
            return true;
        }
        const insertStmt = this.db.prepare(`
      INSERT INTO classify_queue (hash, status, priority, added_at, retries)
      VALUES (?, 'pending', ?, ?, 0)
    `);
        insertStmt.run(hash, priority, now);
        return true;
    }
    /**
     * Get next pending task
     */
    getNextPendingTask() {
        const stmt = this.db.prepare(`
      SELECT * FROM classify_queue
      WHERE status = 'pending'
      ORDER BY priority DESC, added_at ASC
      LIMIT 1
    `);
        const row = stmt.get();
        return row || null;
    }
    /**
     * Update task status
     */
    updateTaskStatus(hash, status, error) {
        const now = new Date().toISOString();
        let stmt;
        if (status === 'processing') {
            stmt = this.db.prepare(`
        UPDATE classify_queue SET status = ?, started_at = ? WHERE hash = ?
      `);
            stmt.run(status, now, hash);
        }
        else if (status === 'completed') {
            stmt = this.db.prepare(`
        UPDATE classify_queue SET status = ?, completed_at = ? WHERE hash = ?
      `);
            stmt.run(status, now, hash);
        }
        else if (status === 'failed') {
            stmt = this.db.prepare(`
        UPDATE classify_queue SET status = ?, error = ?, retries = retries + 1 WHERE hash = ?
      `);
            stmt.run(status, error ?? 'Unknown error', hash);
        }
        else {
            stmt = this.db.prepare(`
        UPDATE classify_queue SET status = ?, error = NULL WHERE hash = ?
      `);
            stmt.run(status, hash);
        }
        return true;
    }
    /**
     * Get queue status summary
     */
    getQueueStatus() {
        const stmt = this.db.prepare(`
      SELECT status, COUNT(*) as count FROM classify_queue GROUP BY status
    `);
        const rows = stmt.all();
        const status = {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            total: 0,
        };
        for (const row of rows) {
            status[row.status] = row.count;
            status.total += row.count;
        }
        return status;
    }
    /**
     * Get pending tasks (for scheduler)
     */
    getPendingTasks(limit = 10) {
        const stmt = this.db.prepare(`
      SELECT * FROM classify_queue
      WHERE status = 'pending'
      ORDER BY priority DESC, added_at ASC
      LIMIT ?
    `);
        return stmt.all(limit);
    }
    /**
     * Get failed tasks
     */
    getFailedTasks() {
        const stmt = this.db.prepare(`
      SELECT * FROM classify_queue WHERE status = 'failed' ORDER BY added_at ASC
    `);
        return stmt.all();
    }
    /**
     * Retry failed tasks
     */
    retryFailedTasks() {
        const stmt = this.db.prepare(`
      UPDATE classify_queue SET status = 'pending', error = NULL WHERE status = 'failed'
    `);
        const result = stmt.run();
        return result.changes;
    }
    /**
     * Clear queue
     */
    clearQueue() {
        this.db.exec('DELETE FROM classify_queue');
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
/**
 * Get default workspace path
 */
export function getDefaultWorkspacePath() {
    return path.join(os.homedir(), '.vfs-workspace');
}
/**
 * Ensure workspace directory exists
 */
export function ensureWorkspace(workspacePath) {
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
//# sourceMappingURL=sqlite.js.map