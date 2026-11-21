"use strict";
/**
 * Media Archive Tasks
 *
 * Copies newly captured media from the local workspace to a mounted directory
 * (for example an SMB share). Each file is represented as an `archive` task in
 * the unified task table, so it appears in the Options task console alongside
 * classify/rename, with pending/processing/completed state.
 *
 * Archive tasks are claimed by a dedicated runner rather than the AI scheduler:
 * `classificationPaused` and Ollama availability must not stop archiving.
 *
 * The destination directory is the source of truth: a file named
 * `<hash>.<ext>` with a matching size is already archived. The companion state
 * file stores the activation baseline and the enqueue-reconciliation cursor.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaArchiveWorker = exports.MediaArchiveTargetError = exports.ARCHIVE_MAX_ATTEMPTS = exports.ARCHIVE_TASK_TYPE = exports.MEDIA_ARCHIVE_EVENT = exports.MEDIA_ARCHIVE_STATE_VERSION = exports.MEDIA_ARCHIVE_STATE_FILE = void 0;
exports.validateMediaArchiveTarget = validateMediaArchiveTarget;
exports.readMediaArchiveState = readMediaArchiveState;
exports.writeMediaArchiveState = writeMediaArchiveState;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const vfs_1 = require("vfs");
exports.MEDIA_ARCHIVE_STATE_FILE = 'media-archive-state.json';
exports.MEDIA_ARCHIVE_STATE_VERSION = 1;
exports.MEDIA_ARCHIVE_EVENT = 'media-archive:status';
exports.ARCHIVE_TASK_TYPE = 'archive';
/**
 * Archive tasks must retry forever. The task engine treats `attempts + 1 >=
 * max_attempts` as terminal, so archive rows carry a very large budget while
 * the runner applies its own capped exponential backoff.
 */
exports.ARCHIVE_MAX_ATTEMPTS = 1_000_000;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_RECONCILE_BATCH_SIZE = 200;
const DEFAULT_MAX_TASKS_PER_DRAIN = 50;
const DEFAULT_RETRY_BASE_DELAY_MS = 60_000;
const DEFAULT_RETRY_MAX_DELAY_MS = 60 * 60_000;
class MediaArchiveTargetError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = 'MediaArchiveTargetError';
        this.code = code;
    }
}
exports.MediaArchiveTargetError = MediaArchiveTargetError;
function comparisonKey(value, platform) {
    const resolved = path_1.default.resolve(value);
    return platform === 'darwin' || platform === 'win32' ? resolved.toLowerCase() : resolved;
}
function isInside(parent, child, platform) {
    const relative = path_1.default.relative(comparisonKey(parent, platform), comparisonKey(child, platform));
    return relative === '' || (!relative.startsWith('..') && !path_1.default.isAbsolute(relative));
}
/**
 * Validate a destination directory. The path must already exist; this function
 * never creates directories so an unmounted volume cannot be replaced by an
 * empty local folder.
 */
function validateMediaArchiveTarget(target, options = {}) {
    const platform = options.platform ?? process.platform;
    const raw = target.trim();
    if (!raw) {
        throw new MediaArchiveTargetError('invalid-path', '请输入归档目标目录');
    }
    const expanded = (0, vfs_1.expandPath)(raw);
    if (!path_1.default.isAbsolute(expanded)) {
        throw new MediaArchiveTargetError('invalid-path', '归档目标必须是绝对路径');
    }
    const resolved = path_1.default.resolve(expanded);
    const key = comparisonKey(resolved, platform);
    if (key === comparisonKey(path_1.default.parse(resolved).root, platform)) {
        throw new MediaArchiveTargetError('forbidden-path', '不能把文件系统根目录作为归档目标');
    }
    if (key === comparisonKey(os_1.default.homedir(), platform)) {
        throw new MediaArchiveTargetError('forbidden-path', '不能把用户主目录本身作为归档目标');
    }
    if (options.workspacePath && isInside(options.workspacePath, resolved, platform)) {
        throw new MediaArchiveTargetError('forbidden-path', '归档目标不能位于工作区内部');
    }
    if (platform === 'darwin' && resolved.startsWith('/Volumes/')) {
        const volumeName = resolved.slice('/Volumes/'.length).split('/')[0];
        const volumeRoot = path_1.default.join('/Volumes', volumeName);
        if (!fs_1.default.existsSync(volumeRoot)) {
            throw new MediaArchiveTargetError('volume-missing', `外置卷 ${volumeRoot} 未挂载`);
        }
    }
    let stats;
    try {
        stats = fs_1.default.statSync(resolved);
    }
    catch (error) {
        const code = error.code;
        if (code === 'ENOENT') {
            throw new MediaArchiveTargetError('not-found', `归档目标目录不存在：${resolved}`);
        }
        throw new MediaArchiveTargetError('invalid-path', `无法访问归档目标：${error instanceof Error ? error.message : String(error)}`);
    }
    if (!stats.isDirectory()) {
        throw new MediaArchiveTargetError('not-a-directory', '归档目标不是目录');
    }
    try {
        fs_1.default.accessSync(resolved, fs_1.default.constants.W_OK);
    }
    catch {
        throw new MediaArchiveTargetError('not-writable', '归档目标不可写');
    }
    return resolved;
}
function emptyState() {
    return {
        version: exports.MEDIA_ARCHIVE_STATE_VERSION,
        activatedAt: null,
        targetPath: '',
        cursor: { createdAt: '', hash: '' },
        requeuePending: false,
    };
}
/**
 * Tolerant state reader: a corrupt file never blocks archiving. Valid fields
 * are kept; missing or malformed ones fall back to defaults.
 */
function readMediaArchiveState(statePath, logger = console) {
    const state = emptyState();
    if (!fs_1.default.existsSync(statePath)) {
        return state;
    }
    try {
        const parsed = JSON.parse(fs_1.default.readFileSync(statePath, 'utf-8'));
        if (typeof parsed.activatedAt === 'string' && parsed.activatedAt) {
            state.activatedAt = parsed.activatedAt;
        }
        if (typeof parsed.targetPath === 'string') {
            state.targetPath = parsed.targetPath;
        }
        if (parsed.cursor && typeof parsed.cursor === 'object') {
            const cursor = parsed.cursor;
            state.cursor = {
                createdAt: typeof cursor.createdAt === 'string' ? cursor.createdAt : '',
                hash: typeof cursor.hash === 'string' ? cursor.hash : '',
            };
        }
        state.requeuePending = parsed.requeuePending === true;
    }
    catch (error) {
        logger.warn(`[MediaArchive] Failed to read state at ${statePath}:`, error);
        return emptyState();
    }
    return state;
}
/**
 * Persist state with an atomic temp-file rename.
 */
function writeMediaArchiveState(statePath, state, logger = console) {
    const dir = path_1.default.dirname(statePath);
    const tempPath = path_1.default.join(dir, `.${path_1.default.basename(statePath)}.${process.pid}.${Date.now()}.tmp`);
    try {
        fs_1.default.mkdirSync(dir, { recursive: true });
        fs_1.default.writeFileSync(tempPath, JSON.stringify(state, null, 2), { mode: 0o600 });
        fs_1.default.renameSync(tempPath, statePath);
    }
    catch (error) {
        try {
            if (fs_1.default.existsSync(tempPath))
                fs_1.default.unlinkSync(tempPath);
        }
        catch {
            // Ignore cleanup errors.
        }
        logger.warn(`[MediaArchive] Failed to write state at ${statePath}:`, error);
    }
}
class MediaArchiveWorker {
    api;
    store;
    events;
    workspacePath;
    now;
    copyFile;
    pollIntervalMs;
    reconcileBatchSize;
    maxTasksPerDrain;
    retryBaseDelayMs;
    retryMaxDelayMs;
    logger;
    statePath;
    state;
    pollTimer = null;
    reconcileTimer = null;
    reconcileIntervalMs = null;
    running = false;
    reconciling = false;
    lastRunAt;
    lastError;
    lastKnownEnabled = false;
    constructor(dependencies) {
        this.api = dependencies.api;
        this.store = dependencies.store;
        this.events = dependencies.events;
        this.workspacePath = dependencies.workspacePath;
        this.now = dependencies.now ?? Date.now;
        this.copyFile = dependencies.copyFile ?? fs_1.default.promises.copyFile.bind(fs_1.default.promises);
        this.pollIntervalMs = dependencies.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
        this.reconcileBatchSize = dependencies.reconcileBatchSize ?? DEFAULT_RECONCILE_BATCH_SIZE;
        this.maxTasksPerDrain = dependencies.maxTasksPerDrain ?? DEFAULT_MAX_TASKS_PER_DRAIN;
        this.retryBaseDelayMs = dependencies.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
        this.retryMaxDelayMs = dependencies.retryMaxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS;
        this.logger = dependencies.logger ?? console;
        this.statePath =
            dependencies.statePath ?? path_1.default.join(this.workspacePath, exports.MEDIA_ARCHIVE_STATE_FILE);
        this.state = readMediaArchiveState(this.statePath, this.logger);
    }
    /**
     * Start the runner: restore the baseline, apply a pending target change, and
     * schedule task polling plus enqueue reconciliation.
     */
    start() {
        this.reconfigure();
    }
    stop() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        if (this.reconcileTimer) {
            clearInterval(this.reconcileTimer);
            this.reconcileTimer = null;
        }
        this.reconcileIntervalMs = null;
    }
    /**
     * Re-read configuration, apply a target change, and reschedule timers.
     */
    reconfigure() {
        const config = this.store.get();
        const enabled = config.mediaArchiveEnabled === true;
        const target = config.mediaArchiveTargetPath;
        if (enabled) {
            this.ensureBaseline();
        }
        this.applyTargetChange(target);
        this.schedule(config);
        const becameEnabled = enabled && !this.lastKnownEnabled;
        this.lastKnownEnabled = enabled;
        this.emitStatus();
        if (becameEnabled && target) {
            void this.runOnce();
        }
    }
    /**
     * Validate and persist archive settings. Rejects a target when enabling.
     */
    updateConfig(update) {
        const current = this.store.get();
        const enabled = update.enabled ?? current.mediaArchiveEnabled;
        const rawTarget = update.targetPath ?? current.mediaArchiveTargetPath;
        const intervalMinutes = update.intervalMinutes ?? current.mediaArchiveIntervalMinutes;
        let target = typeof rawTarget === 'string' ? rawTarget.trim() : '';
        if (enabled) {
            target = validateMediaArchiveTarget(target, { workspacePath: this.workspacePath });
        }
        this.store.update({
            mediaArchiveEnabled: enabled,
            mediaArchiveTargetPath: target,
            mediaArchiveIntervalMinutes: intervalMinutes,
        });
        this.reconfigure();
        return this.getStatus();
    }
    getStatus() {
        const config = this.store.get();
        const summary = this.getArchiveSummary();
        return {
            enabled: config.mediaArchiveEnabled === true,
            targetPath: config.mediaArchiveTargetPath,
            intervalMinutes: config.mediaArchiveIntervalMinutes,
            running: this.running,
            lastRunAt: this.lastRunAt,
            pendingCount: summary.pending + summary.processing,
            failedCount: summary.failed,
            lastError: this.lastError,
        };
    }
    /**
     * Enqueue an archive task for a freshly captured file.
     */
    enqueue(hash, requeue = false) {
        const config = this.store.get();
        if (!config.mediaArchiveEnabled || !config.mediaArchiveTargetPath) {
            return false;
        }
        const { success } = this.api.enqueueTask({
            taskType: exports.ARCHIVE_TASK_TYPE,
            hash,
            maxAttempts: exports.ARCHIVE_MAX_ATTEMPTS,
            requeue,
        });
        if (success) {
            this.emitQueueUpdated();
            // The polling runner picks tasks up on its next tick. Only kick when the
            // runner is active so tests and disabled configurations stay quiet.
            if (this.pollTimer) {
                this.kick();
            }
        }
        return success;
    }
    /**
     * Trigger reconciliation and start draining without waiting for the copies.
     * Manual triggers should return immediately; the task queue reports progress.
     */
    runNow() {
        const config = this.store.get();
        if (!config.mediaArchiveEnabled || !config.mediaArchiveTargetPath) {
            this.emitStatus();
            return this.getStatus();
        }
        try {
            validateMediaArchiveTarget(config.mediaArchiveTargetPath, {
                workspacePath: this.workspacePath,
            });
        }
        catch (error) {
            this.lastError = error instanceof Error ? error.message : String(error);
            this.emitStatus();
            return this.getStatus();
        }
        this.ensureBaseline();
        this.applyTargetChange(config.mediaArchiveTargetPath);
        this.lastError = undefined;
        this.reconcile();
        void this.drainTasks();
        this.emitStatus();
        return this.getStatus();
    }
    /**
     * Reconcile pending work and process a bounded number of tasks. Exposed for
     * tests and the periodic interval.
     */
    async runOnce() {
        const config = this.store.get();
        if (!config.mediaArchiveEnabled || !config.mediaArchiveTargetPath) {
            this.emitStatus();
            return this.getStatus();
        }
        try {
            validateMediaArchiveTarget(config.mediaArchiveTargetPath, {
                workspacePath: this.workspacePath,
            });
        }
        catch (error) {
            this.lastError = error instanceof Error ? error.message : String(error);
            this.logger.warn('[MediaArchive] Target unavailable:', this.lastError);
            this.emitStatus();
            return this.getStatus();
        }
        this.ensureBaseline();
        this.applyTargetChange(config.mediaArchiveTargetPath);
        this.lastError = undefined;
        this.reconcile();
        await this.drainTasks(this.maxTasksPerDrain);
        this.lastRunAt = new Date(this.now()).toISOString();
        this.persist();
        this.emitStatus();
        return this.getStatus();
    }
    /**
     * Process due archive tasks until the queue is empty or the limit is hit.
     */
    async drainTasks(limit = this.maxTasksPerDrain) {
        if (this.running) {
            return;
        }
        const config = this.store.get();
        if (!config.mediaArchiveEnabled || !config.mediaArchiveTargetPath) {
            return;
        }
        let target;
        try {
            target = validateMediaArchiveTarget(config.mediaArchiveTargetPath, {
                workspacePath: this.workspacePath,
            });
        }
        catch (error) {
            this.lastError = error instanceof Error ? error.message : String(error);
            this.logger.warn('[MediaArchive] Target unavailable:', this.lastError);
            this.emitStatus();
            return;
        }
        this.running = true;
        this.emitStatus();
        let processed = 0;
        try {
            while (processed < limit) {
                if (this.store.get().mediaArchiveEnabled !== true) {
                    break;
                }
                const [task] = this.api.claimTasks(1, [exports.ARCHIVE_TASK_TYPE]);
                if (!task) {
                    break;
                }
                await this.processTask(task, target);
                processed += 1;
            }
        }
        catch (error) {
            this.lastError = error instanceof Error ? error.message : String(error);
            this.logger.warn('[MediaArchive] Task drain failed:', this.lastError);
        }
        finally {
            this.running = false;
            this.lastRunAt = new Date(this.now()).toISOString();
            this.emitQueueUpdated();
            this.emitStatus();
        }
    }
    kick() {
        void this.drainTasks();
    }
    /**
     * Enqueue archive tasks for files created since the persisted cursor.
     * On a target change, `requeuePending` makes the sweep reset completed tasks
     * so the new destination receives everything since activation.
     */
    reconcile() {
        if (this.reconciling) {
            return;
        }
        const config = this.store.get();
        if (!config.mediaArchiveEnabled || !config.mediaArchiveTargetPath) {
            return;
        }
        this.reconciling = true;
        try {
            const baseline = this.state.activatedAt ?? new Date(this.now()).toISOString();
            let cursor = this.state.cursor.createdAt
                ? this.state.cursor
                : { createdAt: baseline, hash: '' };
            for (;;) {
                const items = this.api.listFilesCreatedAfter({
                    createdAt: cursor.createdAt,
                    hash: cursor.hash,
                    limit: this.reconcileBatchSize,
                });
                if (items.length === 0) {
                    break;
                }
                for (const item of items) {
                    this.api.enqueueTask({
                        taskType: exports.ARCHIVE_TASK_TYPE,
                        hash: item.hash,
                        maxAttempts: exports.ARCHIVE_MAX_ATTEMPTS,
                        requeue: this.state.requeuePending,
                    });
                    cursor = { createdAt: item.created_at, hash: item.hash };
                }
                this.state.cursor = cursor;
                this.persist();
                if (items.length < this.reconcileBatchSize) {
                    break;
                }
            }
            if (this.state.requeuePending) {
                this.state.requeuePending = false;
                this.persist();
            }
            this.emitQueueUpdated();
        }
        finally {
            this.reconciling = false;
        }
    }
    async processTask(task, target) {
        const hash = task.target_hash;
        this.emitEvent('task:started', { task_type: exports.ARCHIVE_TASK_TYPE, hash });
        const metadata = this.api.getMetadata(hash);
        if (!metadata || metadata.is_deleted === 1) {
            this.completeTask(hash);
            return;
        }
        const source = this.api.getBlobPath(hash);
        if (!source) {
            this.logger.warn(`[MediaArchive] Source blob missing for ${hash}; skipping.`);
            this.completeTask(hash, { skipped: true });
            return;
        }
        try {
            await this.copyOne(target, metadata, source.path);
            this.completeTask(hash);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.lastError = message;
            const retryDelayMs = this.retryDelayFor(task.attempts + 1);
            this.api.updateTaskStatus({
                taskType: exports.ARCHIVE_TASK_TYPE,
                hash,
                status: 'failed',
                error: message,
                retryDelayMs,
            });
            this.emitEvent('task:retrying', {
                task_type: exports.ARCHIVE_TASK_TYPE,
                hash,
                error: message,
                terminal: false,
            });
            this.logger.warn(`[MediaArchive] Failed to archive ${hash}:`, message);
            this.emitQueueUpdated();
            this.emitStatus();
        }
    }
    completeTask(hash, extra = {}) {
        this.api.updateTaskStatus({
            taskType: exports.ARCHIVE_TASK_TYPE,
            hash,
            status: 'completed',
        });
        this.emitEvent('task:completed', { task_type: exports.ARCHIVE_TASK_TYPE, hash, ...extra });
        this.emitQueueUpdated();
    }
    async copyOne(target, metadata, sourcePath) {
        const source = await fs_1.default.promises.stat(sourcePath);
        const destination = path_1.default.join(target, `${metadata.hash}.${metadata.blob_ext}`);
        const tempPath = path_1.default.join(target, `.${metadata.hash}.${metadata.blob_ext}.part`);
        try {
            if (fs_1.default.existsSync(destination)) {
                const existing = fs_1.default.statSync(destination);
                if (existing.size === source.size) {
                    return;
                }
                this.logger.warn(`[MediaArchive] Destination size mismatch for ${destination}; replacing it.`);
            }
            await this.copyFile(sourcePath, tempPath);
            const copied = await fs_1.default.promises.stat(tempPath);
            if (copied.size !== source.size) {
                throw new Error(`复制后大小不一致（期望 ${source.size}，实际 ${copied.size}）`);
            }
            await fs_1.default.promises.rename(tempPath, destination);
        }
        catch (error) {
            try {
                if (fs_1.default.existsSync(tempPath)) {
                    fs_1.default.unlinkSync(tempPath);
                }
            }
            catch {
                // Ignore cleanup errors.
            }
            throw error;
        }
    }
    retryDelayFor(attempt) {
        const delay = this.retryBaseDelayMs * Math.pow(2, Math.min(Math.max(0, attempt - 1), 10));
        return Math.min(delay, this.retryMaxDelayMs);
    }
    ensureBaseline() {
        if (this.state.activatedAt) {
            return;
        }
        const activatedAt = new Date(this.now()).toISOString();
        this.state.activatedAt = activatedAt;
        if (!this.state.cursor.createdAt) {
            this.state.cursor = { createdAt: activatedAt, hash: '' };
        }
        this.persist();
    }
    applyTargetChange(target) {
        const trimmed = typeof target === 'string' ? target.trim() : '';
        if (!trimmed || !path_1.default.isAbsolute((0, vfs_1.expandPath)(trimmed))) {
            return;
        }
        const normalized = path_1.default.resolve((0, vfs_1.expandPath)(trimmed));
        const platform = process.platform;
        const previous = this.state.targetPath;
        if (!previous) {
            this.state.targetPath = normalized;
            if (!this.state.cursor.createdAt) {
                this.state.cursor = {
                    createdAt: this.state.activatedAt ?? new Date(this.now()).toISOString(),
                    hash: '',
                };
            }
            this.persist();
            return;
        }
        if (comparisonKey(previous, platform) !== comparisonKey(normalized, platform)) {
            this.state.targetPath = normalized;
            this.state.cursor = {
                createdAt: this.state.activatedAt ?? new Date(this.now()).toISOString(),
                hash: '',
            };
            this.state.requeuePending = true;
            this.persist();
        }
    }
    schedule(config) {
        const enabled = config.mediaArchiveEnabled === true && Boolean(config.mediaArchiveTargetPath);
        if (!enabled) {
            if (this.pollTimer) {
                clearInterval(this.pollTimer);
                this.pollTimer = null;
            }
            if (this.reconcileTimer) {
                clearInterval(this.reconcileTimer);
                this.reconcileTimer = null;
            }
            this.reconcileIntervalMs = null;
            return;
        }
        if (!this.pollTimer) {
            this.pollTimer = setInterval(() => {
                void this.drainTasks();
            }, this.pollIntervalMs);
            this.pollTimer.unref?.();
        }
        const intervalMs = Math.max(1, config.mediaArchiveIntervalMinutes) * 60_000;
        if (!this.reconcileTimer || this.reconcileIntervalMs !== intervalMs) {
            if (this.reconcileTimer) {
                clearInterval(this.reconcileTimer);
            }
            this.reconcileTimer = setInterval(() => {
                void this.runOnce();
            }, intervalMs);
            this.reconcileTimer.unref?.();
            this.reconcileIntervalMs = intervalMs;
        }
    }
    getArchiveSummary() {
        try {
            const summary = this.api.getQueueStatus().byType[exports.ARCHIVE_TASK_TYPE];
            return (summary ?? { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, total: 0 });
        }
        catch {
            return { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, total: 0 };
        }
    }
    persist() {
        writeMediaArchiveState(this.statePath, this.state, this.logger);
    }
    emitStatus() {
        this.events.emit(exports.MEDIA_ARCHIVE_EVENT, this.getStatus());
    }
    emitQueueUpdated() {
        try {
            this.events.emit('queue:updated', this.api.getQueueStatus());
        }
        catch (error) {
            console.warn('[MediaArchive] Failed to broadcast queue update:', error);
        }
    }
    emitEvent(type, data) {
        this.events.emit(type, data);
    }
}
exports.MediaArchiveWorker = MediaArchiveWorker;
//# sourceMappingURL=media-archive.js.map