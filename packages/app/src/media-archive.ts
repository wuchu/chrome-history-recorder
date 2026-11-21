/**
 * Media Archive Tasks
 *
 * Copies newly captured media from the local workspace to a mounted directory
 * (for example an SMB share). Each file is represented as an `archive` task in
 * the unified task table, so it appears in the Options task console alongside
 * classify/rename, with pending/processing/completed state.
 *
 * Archive tasks are claimed by a dedicated runner rather than the AI scheduler:
 * `classifyPaused`, `renamePaused`, and Ollama availability must not stop
 * archiving.
 *
 * The destination directory is the source of truth: a file named
 * `<hash>.<ext>` with a matching size is already archived. The companion state
 * file stores the activation baseline and the enqueue-reconciliation cursor.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { expandPath, type FileMetadata, type TaskItem, type VFSAPI } from 'vfs';
import type { ConfigStore } from './config-store';
import type { EventBus } from './event-bus';
import {
  DEFAULT_TASK_CONCURRENCY,
  MAX_TASK_CONCURRENCY,
  MIN_TASK_CONCURRENCY,
  type AppConfig,
} from './types';

export const MEDIA_ARCHIVE_STATE_FILE = 'media-archive-state.json';
export const MEDIA_ARCHIVE_STATE_VERSION = 1;
export const MEDIA_ARCHIVE_EVENT = 'media-archive:status';
export const ARCHIVE_TASK_TYPE = 'archive';

/**
 * Archive tasks must retry forever. The task engine treats `attempts + 1 >=
 * max_attempts` as terminal, so archive rows carry a very large budget while
 * the runner applies its own capped exponential backoff.
 */
export const ARCHIVE_MAX_ATTEMPTS = 1_000_000;

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_RECONCILE_BATCH_SIZE = 200;
const DEFAULT_MAX_TASKS_PER_DRAIN = 50;
const DEFAULT_RETRY_BASE_DELAY_MS = 60_000;
const DEFAULT_RETRY_MAX_DELAY_MS = 60 * 60_000;

export interface MediaArchiveCursor {
  createdAt: string;
  hash: string;
}

export interface MediaArchiveState {
  version: number;
  activatedAt: string | null;
  targetPath: string;
  cursor: MediaArchiveCursor;
  /** Target changed; requeue already-enqueued tasks while reconciling. */
  requeuePending: boolean;
}

export interface MediaArchiveStatus {
  enabled: boolean;
  targetPath: string;
  intervalMinutes: number;
  concurrency: number;
  running: boolean;
  lastRunAt?: string;
  pendingCount: number;
  failedCount: number;
  lastError?: string;
}

export interface MediaArchiveConfigUpdate {
  enabled?: boolean;
  targetPath?: string;
  intervalMinutes?: number;
  concurrency?: number;
}

export type MediaArchiveTargetErrorCode =
  | 'invalid-path'
  | 'forbidden-path'
  | 'not-found'
  | 'not-a-directory'
  | 'not-writable'
  | 'volume-missing';

export class MediaArchiveTargetError extends Error {
  readonly code: MediaArchiveTargetErrorCode;

  constructor(code: MediaArchiveTargetErrorCode, message: string) {
    super(message);
    this.name = 'MediaArchiveTargetError';
    this.code = code;
  }
}

export interface ValidateMediaArchiveTargetOptions {
  workspacePath?: string;
  platform?: NodeJS.Platform;
}

export interface MediaArchiveDependencies {
  api: Pick<
    VFSAPI,
    | 'listFilesCreatedAfter'
    | 'getMetadata'
    | 'getBlobPath'
    | 'enqueueTask'
    | 'claimTasks'
    | 'updateTaskStatus'
    | 'getQueueStatus'
  >;
  store: Pick<ConfigStore, 'get' | 'update'>;
  events: Pick<EventBus, 'emit'>;
  workspacePath: string;
  now?: () => number;
  copyFile?: (source: string, destination: string) => Promise<void>;
  pollIntervalMs?: number;
  reconcileBatchSize?: number;
  maxTasksPerDrain?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  logger?: Pick<Console, 'warn' | 'error'>;
  statePath?: string;
}

function comparisonKey(value: string, platform: NodeJS.Platform): string {
  const resolved = path.resolve(value);
  return platform === 'darwin' || platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isInside(parent: string, child: string, platform: NodeJS.Platform): boolean {
  const relative = path.relative(comparisonKey(parent, platform), comparisonKey(child, platform));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Validate a destination directory. The path must already exist; this function
 * never creates directories so an unmounted volume cannot be replaced by an
 * empty local folder.
 */
export function validateMediaArchiveTarget(
  target: string,
  options: ValidateMediaArchiveTargetOptions = {}
): string {
  const platform = options.platform ?? process.platform;
  const raw = target.trim();
  if (!raw) {
    throw new MediaArchiveTargetError('invalid-path', '请输入归档目标目录');
  }

  const expanded = expandPath(raw);
  if (!path.isAbsolute(expanded)) {
    throw new MediaArchiveTargetError('invalid-path', '归档目标必须是绝对路径');
  }

  const resolved = path.resolve(expanded);
  const key = comparisonKey(resolved, platform);

  if (key === comparisonKey(path.parse(resolved).root, platform)) {
    throw new MediaArchiveTargetError('forbidden-path', '不能把文件系统根目录作为归档目标');
  }
  if (key === comparisonKey(os.homedir(), platform)) {
    throw new MediaArchiveTargetError('forbidden-path', '不能把用户主目录本身作为归档目标');
  }
  if (options.workspacePath && isInside(options.workspacePath, resolved, platform)) {
    throw new MediaArchiveTargetError('forbidden-path', '归档目标不能位于工作区内部');
  }

  if (platform === 'darwin' && resolved.startsWith('/Volumes/')) {
    const volumeName = resolved.slice('/Volumes/'.length).split('/')[0];
    const volumeRoot = path.join('/Volumes', volumeName);
    if (!fs.existsSync(volumeRoot)) {
      throw new MediaArchiveTargetError('volume-missing', `外置卷 ${volumeRoot} 未挂载`);
    }
  }

  let stats: fs.Stats;
  try {
    stats = fs.statSync(resolved);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new MediaArchiveTargetError('not-found', `归档目标目录不存在：${resolved}`);
    }
    throw new MediaArchiveTargetError(
      'invalid-path',
      `无法访问归档目标：${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!stats.isDirectory()) {
    throw new MediaArchiveTargetError('not-a-directory', '归档目标不是目录');
  }

  try {
    fs.accessSync(resolved, fs.constants.W_OK);
  } catch {
    throw new MediaArchiveTargetError('not-writable', '归档目标不可写');
  }

  return resolved;
}

function emptyState(): MediaArchiveState {
  return {
    version: MEDIA_ARCHIVE_STATE_VERSION,
    activatedAt: null,
    targetPath: '',
    cursor: { createdAt: '', hash: '' },
    requeuePending: false,
  };
}

function normalizeArchiveConcurrency(value: number): number {
  return Number.isFinite(value)
    ? Math.min(MAX_TASK_CONCURRENCY, Math.max(MIN_TASK_CONCURRENCY, Math.floor(value)))
    : DEFAULT_TASK_CONCURRENCY;
}

/**
 * Tolerant state reader: a corrupt file never blocks archiving. Valid fields
 * are kept; missing or malformed ones fall back to defaults.
 */
export function readMediaArchiveState(
  statePath: string,
  logger: Pick<Console, 'warn'> = console
): MediaArchiveState {
  const state = emptyState();
  if (!fs.existsSync(statePath)) {
    return state;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Partial<MediaArchiveState>;
    if (typeof parsed.activatedAt === 'string' && parsed.activatedAt) {
      state.activatedAt = parsed.activatedAt;
    }
    if (typeof parsed.targetPath === 'string') {
      state.targetPath = parsed.targetPath;
    }
    if (parsed.cursor && typeof parsed.cursor === 'object') {
      const cursor = parsed.cursor as Partial<MediaArchiveCursor>;
      state.cursor = {
        createdAt: typeof cursor.createdAt === 'string' ? cursor.createdAt : '',
        hash: typeof cursor.hash === 'string' ? cursor.hash : '',
      };
    }
    state.requeuePending = parsed.requeuePending === true;
  } catch (error) {
    logger.warn(`[MediaArchive] Failed to read state at ${statePath}:`, error);
    return emptyState();
  }

  return state;
}

/**
 * Persist state with an atomic temp-file rename.
 */
export function writeMediaArchiveState(
  statePath: string,
  state: MediaArchiveState,
  logger: Pick<Console, 'warn'> = console
): void {
  const dir = path.dirname(statePath);
  const tempPath = path.join(dir, `.${path.basename(statePath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.renameSync(tempPath, statePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors.
    }
    logger.warn(`[MediaArchive] Failed to write state at ${statePath}:`, error);
  }
}

export class MediaArchiveWorker {
  private readonly api: MediaArchiveDependencies['api'];
  private readonly store: MediaArchiveDependencies['store'];
  private readonly events: Pick<EventBus, 'emit'>;
  private readonly workspacePath: string;
  private readonly now: () => number;
  private readonly copyFile: (source: string, destination: string) => Promise<void>;
  private readonly pollIntervalMs: number;
  private readonly reconcileBatchSize: number;
  private readonly maxTasksPerDrain: number;
  private readonly retryBaseDelayMs: number;
  private readonly retryMaxDelayMs: number;
  private readonly logger: Pick<Console, 'warn' | 'error'>;
  private readonly statePath: string;

  private state: MediaArchiveState;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reconcileTimer: ReturnType<typeof setInterval> | null = null;
  private reconcileIntervalMs: number | null = null;
  private running = false;
  private reconciling = false;
  private lastRunAt?: string;
  private lastError?: string;
  private lastKnownEnabled = false;

  constructor(dependencies: MediaArchiveDependencies) {
    this.api = dependencies.api;
    this.store = dependencies.store;
    this.events = dependencies.events;
    this.workspacePath = dependencies.workspacePath;
    this.now = dependencies.now ?? Date.now;
    this.copyFile = dependencies.copyFile ?? fs.promises.copyFile.bind(fs.promises);
    this.pollIntervalMs = dependencies.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.reconcileBatchSize = dependencies.reconcileBatchSize ?? DEFAULT_RECONCILE_BATCH_SIZE;
    this.maxTasksPerDrain = dependencies.maxTasksPerDrain ?? DEFAULT_MAX_TASKS_PER_DRAIN;
    this.retryBaseDelayMs = dependencies.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.retryMaxDelayMs = dependencies.retryMaxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS;
    this.logger = dependencies.logger ?? console;
    this.statePath =
      dependencies.statePath ?? path.join(this.workspacePath, MEDIA_ARCHIVE_STATE_FILE);
    this.state = readMediaArchiveState(this.statePath, this.logger);
  }

  /**
   * Start the runner: restore the baseline, apply a pending target change, and
   * schedule task polling plus enqueue reconciliation.
   */
  start(): void {
    this.reconfigure();
  }

  stop(): void {
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
  reconfigure(): void {
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
  updateConfig(update: MediaArchiveConfigUpdate): MediaArchiveStatus {
    const current = this.store.get();
    const enabled = update.enabled ?? current.mediaArchiveEnabled;
    const rawTarget = update.targetPath ?? current.mediaArchiveTargetPath;
    const intervalMinutes = update.intervalMinutes ?? current.mediaArchiveIntervalMinutes;
    const concurrency = normalizeArchiveConcurrency(
      update.concurrency ?? current.mediaArchiveConcurrency
    );

    let target = typeof rawTarget === 'string' ? rawTarget.trim() : '';
    if (enabled) {
      target = validateMediaArchiveTarget(target, { workspacePath: this.workspacePath });
    }

    this.store.update({
      mediaArchiveEnabled: enabled,
      mediaArchiveTargetPath: target,
      mediaArchiveIntervalMinutes: intervalMinutes,
      mediaArchiveConcurrency: concurrency,
    });
    this.reconfigure();
    return this.getStatus();
  }

  getStatus(): MediaArchiveStatus {
    const config = this.store.get();
    const summary = this.getArchiveSummary();
    return {
      enabled: config.mediaArchiveEnabled === true,
      targetPath: config.mediaArchiveTargetPath,
      intervalMinutes: config.mediaArchiveIntervalMinutes,
      concurrency: config.mediaArchiveConcurrency,
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
  enqueue(hash: string, requeue = false): boolean {
    const config = this.store.get();
    if (!config.mediaArchiveEnabled || !config.mediaArchiveTargetPath) {
      return false;
    }

    const { success } = this.api.enqueueTask({
      taskType: ARCHIVE_TASK_TYPE,
      hash,
      maxAttempts: ARCHIVE_MAX_ATTEMPTS,
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
  runNow(): MediaArchiveStatus {
    const config = this.store.get();
    if (!config.mediaArchiveEnabled || !config.mediaArchiveTargetPath) {
      this.emitStatus();
      return this.getStatus();
    }

    try {
      validateMediaArchiveTarget(config.mediaArchiveTargetPath, {
        workspacePath: this.workspacePath,
      });
    } catch (error) {
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
  async runOnce(): Promise<MediaArchiveStatus> {
    const config = this.store.get();
    if (!config.mediaArchiveEnabled || !config.mediaArchiveTargetPath) {
      this.emitStatus();
      return this.getStatus();
    }

    try {
      validateMediaArchiveTarget(config.mediaArchiveTargetPath, {
        workspacePath: this.workspacePath,
      });
    } catch (error) {
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
   * Copies run concurrently up to `mediaArchiveConcurrency`.
   */
  async drainTasks(limit = this.maxTasksPerDrain): Promise<void> {
    if (this.running) {
      return;
    }

    const config = this.store.get();
    if (!config.mediaArchiveEnabled || !config.mediaArchiveTargetPath) {
      return;
    }

    let target: string;
    try {
      target = validateMediaArchiveTarget(config.mediaArchiveTargetPath, {
        workspacePath: this.workspacePath,
      });
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.warn('[MediaArchive] Target unavailable:', this.lastError);
      this.emitStatus();
      return;
    }

    this.running = true;
    this.emitStatus();

    const inFlight = new Map<string, Promise<void>>();
    let processed = 0;

    try {
      while (processed < limit) {
        const current = this.store.get();
        if (current.mediaArchiveEnabled !== true) {
          break;
        }

        const concurrency = normalizeArchiveConcurrency(current.mediaArchiveConcurrency);
        const free = concurrency - inFlight.size;

        if (free <= 0) {
          await Promise.race(Array.from(inFlight.values()));
          continue;
        }

        const tasks = this.api.claimTasks(Math.min(free, limit - processed), [ARCHIVE_TASK_TYPE]);
        if (tasks.length === 0) {
          if (inFlight.size === 0) {
            break;
          }
          await Promise.race(Array.from(inFlight.values()));
          continue;
        }

        processed += tasks.length;
        for (const task of tasks) {
          const hash = task.target_hash;
          const promise = this.processTask(task, target)
            .catch((error) => {
              this.lastError = error instanceof Error ? error.message : String(error);
              this.logger.warn('[MediaArchive] Task processing failed:', this.lastError);
            })
            .finally(() => {
              inFlight.delete(hash);
              this.emitQueueUpdated();
              this.emitStatus();
            });
          inFlight.set(hash, promise);
        }
      }

      await Promise.allSettled(Array.from(inFlight.values()));
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.warn('[MediaArchive] Task drain failed:', this.lastError);
    } finally {
      this.running = false;
      this.lastRunAt = new Date(this.now()).toISOString();
      this.emitQueueUpdated();
      this.emitStatus();
    }
  }

  private kick(): void {
    void this.drainTasks();
  }

  /**
   * Enqueue archive tasks for files created since the persisted cursor.
   * On a target change, `requeuePending` makes the sweep reset completed tasks
   * so the new destination receives everything since activation.
   */
  private reconcile(): void {
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
            taskType: ARCHIVE_TASK_TYPE,
            hash: item.hash,
            maxAttempts: ARCHIVE_MAX_ATTEMPTS,
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
    } finally {
      this.reconciling = false;
    }
  }

  private async processTask(task: TaskItem, target: string): Promise<void> {
    const hash = task.target_hash;
    this.emitEvent('task:started', { task_type: ARCHIVE_TASK_TYPE, hash });

    const metadata = this.api.getMetadata(hash);
    if (!metadata) {
      this.completeTask(hash);
      return;
    }
    if (metadata.is_deleted === 1) {
      // The file was moved to the trash after this task was claimed. Release
      // it back to pending without consuming an attempt; the claim filter
      // suspends it until the file is restored.
      this.api.updateTaskStatus({ taskType: ARCHIVE_TASK_TYPE, hash, status: 'pending' });
      this.emitQueueUpdated();
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      const retryDelayMs = this.retryDelayFor(task.attempts + 1);
      this.api.updateTaskStatus({
        taskType: ARCHIVE_TASK_TYPE,
        hash,
        status: 'failed',
        error: message,
        retryDelayMs,
      });
      this.emitEvent('task:retrying', {
        task_type: ARCHIVE_TASK_TYPE,
        hash,
        error: message,
        terminal: false,
      });
      this.logger.warn(`[MediaArchive] Failed to archive ${hash}:`, message);
      this.emitQueueUpdated();
      this.emitStatus();
    }
  }

  private completeTask(hash: string, extra: Record<string, unknown> = {}): void {
    this.api.updateTaskStatus({
      taskType: ARCHIVE_TASK_TYPE,
      hash,
      status: 'completed',
    });
    this.emitEvent('task:completed', { task_type: ARCHIVE_TASK_TYPE, hash, ...extra });
    this.emitQueueUpdated();
  }

  private async copyOne(
    target: string,
    metadata: Pick<FileMetadata, 'hash' | 'blob_ext'>,
    sourcePath: string
  ): Promise<void> {
    const source = await fs.promises.stat(sourcePath);
    const destination = path.join(target, `${metadata.hash}.${metadata.blob_ext}`);
    const tempPath = path.join(target, `.${metadata.hash}.${metadata.blob_ext}.part`);

    try {
      if (fs.existsSync(destination)) {
        const existing = fs.statSync(destination);
        if (existing.size === source.size) {
          return;
        }
        this.logger.warn(
          `[MediaArchive] Destination size mismatch for ${destination}; replacing it.`
        );
      }

      await this.copyFile(sourcePath, tempPath);
      const copied = await fs.promises.stat(tempPath);
      if (copied.size !== source.size) {
        throw new Error(`复制后大小不一致（期望 ${source.size}，实际 ${copied.size}）`);
      }
      await fs.promises.rename(tempPath, destination);

      // A permanent delete may have completed while the copy was in flight.
      // Do not resurrect the archived copy in that case.
      if (!this.api.getMetadata(metadata.hash)) {
        try {
          fs.unlinkSync(destination);
        } catch {
          // Best-effort cleanup.
        }
      }
    } catch (error) {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch {
        // Ignore cleanup errors.
      }
      throw error;
    }
  }

  /**
   * Remove the archived copy of a permanently deleted source file.
   *
   * Best-effort: a disabled archive, unavailable target, or missing copy is
   * not an error and must not block local deletion.
   */
  deleteArchived(hash: string, ext: string): void {
    const config = this.store.get();
    if (!config.mediaArchiveEnabled || !config.mediaArchiveTargetPath) {
      return;
    }

    let target: string;
    try {
      target = validateMediaArchiveTarget(config.mediaArchiveTargetPath, {
        workspacePath: this.workspacePath,
      });
    } catch (error) {
      this.logger.warn(
        '[MediaArchive] Cannot remove archived copy:',
        error instanceof Error ? error.message : String(error)
      );
      return;
    }

    const destination = path.join(target, `${hash}.${ext}`);
    try {
      fs.unlinkSync(destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(
          `[MediaArchive] Failed to remove archived copy ${destination}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  private retryDelayFor(attempt: number): number {
    const delay = this.retryBaseDelayMs * Math.pow(2, Math.min(Math.max(0, attempt - 1), 10));
    return Math.min(delay, this.retryMaxDelayMs);
  }

  private ensureBaseline(): void {
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

  private applyTargetChange(target: string): void {
    const trimmed = typeof target === 'string' ? target.trim() : '';
    if (!trimmed || !path.isAbsolute(expandPath(trimmed))) {
      return;
    }

    const normalized = path.resolve(expandPath(trimmed));
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

  private schedule(config: AppConfig): void {
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

  private getArchiveSummary(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    skipped: number;
    total: number;
  } {
    try {
      const summary = this.api.getQueueStatus().byType[ARCHIVE_TASK_TYPE];
      return (
        summary ?? { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, total: 0 }
      );
    } catch {
      return { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, total: 0 };
    }
  }

  private persist(): void {
    writeMediaArchiveState(this.statePath, this.state, this.logger);
  }

  private emitStatus(): void {
    this.events.emit(MEDIA_ARCHIVE_EVENT, this.getStatus());
  }

  private emitQueueUpdated(): void {
    try {
      this.events.emit('queue:updated', this.api.getQueueStatus());
    } catch (error) {
      console.warn('[MediaArchive] Failed to broadcast queue update:', error);
    }
  }

  private emitEvent(type: string, data: unknown): void {
    this.events.emit(type, data);
  }
}
