/**
 * VFS Service - Buffered Video Assembly
 *
 * Accepts byte ranges for a media resource, writes them into a temporary file
 * at their offsets, and only finalizes when every byte of the resource has
 * been received. Incomplete assemblies are discarded; no gap filling or
 * re-downloading happens here.
 */

import crypto from 'crypto';
import fs from 'fs';
import type { FileHandle } from 'fs/promises';
import path from 'path';
import type { VFSAPI, SaveFileResult } from './api';

export const DEFAULT_ASSEMBLY_MAX_BYTES = 200 * 1024 * 1024;
export const DEFAULT_ASSEMBLY_MAX_CONCURRENT = 8;
export const DEFAULT_ASSEMBLY_INACTIVITY_MS = 30 * 60 * 1000;
export const DEFAULT_ASSEMBLY_RETENTION_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_ASSEMBLY_SWEEP_INTERVAL_MS = 60 * 1000;

const TEMP_FILE_PREFIX = 'assembly-';

export interface AssemblyManagerOptions {
  maxBytes?: number;
  maxConcurrent?: number;
  inactivityMs?: number;
  retentionMs?: number;
  sweepIntervalMs?: number;
  now?: () => number;
}

export interface AssemblyCreateInput {
  totalSize: number;
  mimeType: string;
  sourceUrl?: string;
  pageUrl?: string;
  capturedAt?: string;
}

export interface AssemblyJobHandle {
  jobId: string;
  token: string;
}

interface ByteRange {
  start: number;
  end: number;
}

interface AssemblyJob {
  id: string;
  token: string;
  filePath: string;
  handle: FileHandle;
  totalSize: number;
  mimeType: string;
  sourceUrl?: string;
  pageUrl?: string;
  capturedAt: string;
  intervals: ByteRange[];
  lastActivity: number;
}

export class AssemblyNotFoundError extends Error {
  constructor(jobId: string) {
    super(`Assembly job not found: ${jobId}`);
    this.name = 'AssemblyNotFoundError';
  }
}

export class AssemblyUnauthorizedError extends Error {
  constructor() {
    super('Invalid assembly token');
    this.name = 'AssemblyUnauthorizedError';
  }
}

export class AssemblyCapacityError extends Error {
  constructor(limit: number) {
    super(`Assembly concurrency limit reached (${limit})`);
    this.name = 'AssemblyCapacityError';
  }
}

export class AssemblyInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssemblyInvalidError';
  }
}

export class AssemblyIncompleteError extends Error {
  constructor(
    readonly missingBytes: number,
    readonly totalSize: number
  ) {
    super(`Assembly is incomplete: ${missingBytes} of ${totalSize} bytes missing`);
    this.name = 'AssemblyIncompleteError';
  }
}

function mergeRanges(ranges: ByteRange[]): ByteRange[] {
  const sorted = ranges
    .filter((range) => range.start >= 0 && range.end >= range.start)
    .map((range) => ({ ...range }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: ByteRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end + 1) {
      merged.push(range);
      continue;
    }
    if (range.end > last.end) last.end = range.end;
  }
  return merged;
}

function missingBytes(ranges: ByteRange[], total: number): number {
  let covered = 0;
  for (const range of mergeRanges(ranges)) {
    if (range.end < 0 || range.start >= total) continue;
    const start = Math.max(0, range.start);
    const end = Math.min(total - 1, range.end);
    if (end >= start) covered += end - start + 1;
  }
  return Math.max(0, total - covered);
}

function tokensEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Owns temporary assembly files and their coverage ledgers.
 */
export class AssemblyManager {
  private readonly api: VFSAPI;
  private readonly tempDir: string;
  private readonly maxBytes: number;
  private readonly maxConcurrent: number;
  private readonly inactivityMs: number;
  private readonly retentionMs: number;
  private readonly now: () => number;
  private readonly jobs = new Map<string, AssemblyJob>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(api: VFSAPI, workspacePath: string, options: AssemblyManagerOptions = {}) {
    this.api = api;
    this.tempDir = path.join(workspacePath, '.tmp', 'assemblies');
    this.maxBytes = options.maxBytes ?? DEFAULT_ASSEMBLY_MAX_BYTES;
    this.maxConcurrent = options.maxConcurrent ?? DEFAULT_ASSEMBLY_MAX_CONCURRENT;
    this.inactivityMs = options.inactivityMs ?? DEFAULT_ASSEMBLY_INACTIVITY_MS;
    this.retentionMs = options.retentionMs ?? DEFAULT_ASSEMBLY_RETENTION_MS;
    this.now = options.now ?? Date.now;

    this.cleanupStaleFiles();

    const sweepInterval = options.sweepIntervalMs ?? DEFAULT_ASSEMBLY_SWEEP_INTERVAL_MS;
    if (sweepInterval > 0) {
      this.sweepTimer = setInterval(() => void this.sweep(), sweepInterval);
      this.sweepTimer.unref?.();
    }
  }

  getActiveCount(): number {
    return this.jobs.size;
  }

  async createJob(input: AssemblyCreateInput): Promise<AssemblyJobHandle> {
    const { totalSize, mimeType } = input;

    if (!Number.isSafeInteger(totalSize) || totalSize <= 0) {
      throw new AssemblyInvalidError('totalSize must be a positive integer');
    }
    if (totalSize > this.maxBytes) {
      throw new AssemblyInvalidError(`totalSize exceeds maximum of ${this.maxBytes} bytes`);
    }
    if (!mimeType.startsWith('video/')) {
      throw new AssemblyInvalidError(`Unsupported MIME type: ${mimeType}`);
    }
    if (this.jobs.size >= this.maxConcurrent) {
      throw new AssemblyCapacityError(this.maxConcurrent);
    }

    const jobId = crypto.randomUUID();
    const token = crypto.randomBytes(24).toString('hex');
    const filePath = path.join(this.tempDir, `${TEMP_FILE_PREFIX}${jobId}.part`);
    await fs.promises.mkdir(this.tempDir, { recursive: true, mode: 0o755 });
    const handle = await fs.promises.open(filePath, 'w', 0o644);
    try {
      // Preallocate so offset writes are always inside the file.
      await handle.truncate(totalSize);
    } catch (error) {
      await handle.close().catch(() => undefined);
      await fs.promises.unlink(filePath).catch(() => undefined);
      throw error;
    }

    const job: AssemblyJob = {
      id: jobId,
      token,
      filePath,
      handle,
      totalSize,
      mimeType,
      sourceUrl: input.sourceUrl,
      pageUrl: input.pageUrl,
      capturedAt: input.capturedAt ?? new Date().toISOString(),
      intervals: [],
      lastActivity: this.now(),
    };
    this.jobs.set(jobId, job);
    return { jobId, token };
  }

  async writeChunk(
    jobId: string,
    token: string,
    offset: number,
    data: Buffer
  ): Promise<{ receivedBytes: number }> {
    const job = this.requireJob(jobId, token);

    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new AssemblyInvalidError('offset must be a non-negative integer');
    }
    if (!Buffer.isBuffer(data) || data.length === 0) {
      throw new AssemblyInvalidError('chunk body is empty');
    }
    if (offset + data.length > job.totalSize) {
      throw new AssemblyInvalidError(
        `chunk ${offset}+${data.length} exceeds total size ${job.totalSize}`
      );
    }

    let written = 0;
    while (written < data.length) {
      const result = await job.handle.write(data, written, data.length - written, offset + written);
      if (result.bytesWritten <= 0) {
        throw new Error('Failed to write assembly chunk');
      }
      written += result.bytesWritten;
    }

    job.intervals = mergeRanges([
      ...job.intervals,
      { start: offset, end: offset + data.length - 1 },
    ]);
    job.lastActivity = this.now();

    return { receivedBytes: this.coveredBytes(job) };
  }

  async complete(jobId: string, token: string): Promise<SaveFileResult> {
    const job = this.requireJob(jobId, token);
    const missing = missingBytes(job.intervals, job.totalSize);
    if (missing > 0) {
      throw new AssemblyIncompleteError(missing, job.totalSize);
    }

    this.jobs.delete(jobId);
    job.lastActivity = this.now();

    try {
      await job.handle.close();
    } catch {
      // The handle may already be closed by a concurrent abort.
    }

    try {
      const result = await this.api.saveFileFromStream({
        stream: fs.createReadStream(job.filePath),
        mimeType: job.mimeType,
        sourceUrl: job.sourceUrl,
        capturedAt: job.capturedAt,
        maxBytes: job.totalSize,
      });
      return result;
    } finally {
      await fs.promises.unlink(job.filePath).catch(() => undefined);
    }
  }

  async abort(jobId: string, token?: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (token !== undefined && !tokensEqual(job.token, token)) {
      throw new AssemblyUnauthorizedError();
    }

    this.jobs.delete(jobId);
    await job.handle.close().catch(() => undefined);
    await fs.promises.unlink(job.filePath).catch(() => undefined);
  }

  async abortAll(): Promise<void> {
    const jobs = [...this.jobs.values()];
    this.jobs.clear();
    await Promise.all(
      jobs.map(async (job) => {
        await job.handle.close().catch(() => undefined);
        await fs.promises.unlink(job.filePath).catch(() => undefined);
      })
    );
  }

  async sweep(): Promise<void> {
    const cutoff = this.now() - this.inactivityMs;
    for (const job of [...this.jobs.values()]) {
      if (job.lastActivity > cutoff) continue;
      console.warn(`[Assembly] Expiring inactive job ${job.id}`);
      await this.abort(job.id).catch(() => undefined);
    }
  }

  close(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    void this.abortAll();
  }

  private requireJob(jobId: string, token: string): AssemblyJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new AssemblyNotFoundError(jobId);
    if (!tokensEqual(job.token, token)) throw new AssemblyUnauthorizedError();
    return job;
  }

  private coveredBytes(job: AssemblyJob): number {
    return job.totalSize - missingBytes(job.intervals, job.totalSize);
  }

  private cleanupStaleFiles(): void {
    let entries: string[];
    try {
      entries = fs.readdirSync(this.tempDir);
    } catch {
      return;
    }

    const cutoff = this.now() - this.retentionMs;
    for (const entry of entries) {
      if (!entry.startsWith(TEMP_FILE_PREFIX)) continue;
      const filePath = path.join(this.tempDir, entry);
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile() || stat.mtimeMs > cutoff) continue;
        fs.unlinkSync(filePath);
      } catch {
        // Best-effort cleanup.
      }
    }
  }
}
