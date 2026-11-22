"use strict";
/**
 * VFS Service - Buffered Video Assembly
 *
 * Accepts byte ranges for a media resource, writes them into a temporary file
 * at their offsets, and only finalizes when every byte of the resource has
 * been received. Incomplete assemblies are discarded; no gap filling or
 * re-downloading happens here.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssemblyManager = exports.AssemblyIncompleteError = exports.AssemblyInvalidError = exports.AssemblyCapacityError = exports.AssemblyUnauthorizedError = exports.AssemblyNotFoundError = exports.DEFAULT_ASSEMBLY_SWEEP_INTERVAL_MS = exports.DEFAULT_ASSEMBLY_RETENTION_MS = exports.DEFAULT_ASSEMBLY_INACTIVITY_MS = exports.DEFAULT_ASSEMBLY_MAX_CONCURRENT = exports.DEFAULT_ASSEMBLY_MAX_BYTES = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
exports.DEFAULT_ASSEMBLY_MAX_BYTES = 200 * 1024 * 1024;
exports.DEFAULT_ASSEMBLY_MAX_CONCURRENT = 8;
exports.DEFAULT_ASSEMBLY_INACTIVITY_MS = 30 * 60 * 1000;
exports.DEFAULT_ASSEMBLY_RETENTION_MS = 24 * 60 * 60 * 1000;
exports.DEFAULT_ASSEMBLY_SWEEP_INTERVAL_MS = 60 * 1000;
const TEMP_FILE_PREFIX = 'assembly-';
class AssemblyNotFoundError extends Error {
    constructor(jobId) {
        super(`Assembly job not found: ${jobId}`);
        this.name = 'AssemblyNotFoundError';
    }
}
exports.AssemblyNotFoundError = AssemblyNotFoundError;
class AssemblyUnauthorizedError extends Error {
    constructor() {
        super('Invalid assembly token');
        this.name = 'AssemblyUnauthorizedError';
    }
}
exports.AssemblyUnauthorizedError = AssemblyUnauthorizedError;
class AssemblyCapacityError extends Error {
    constructor(limit) {
        super(`Assembly concurrency limit reached (${limit})`);
        this.name = 'AssemblyCapacityError';
    }
}
exports.AssemblyCapacityError = AssemblyCapacityError;
class AssemblyInvalidError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AssemblyInvalidError';
    }
}
exports.AssemblyInvalidError = AssemblyInvalidError;
class AssemblyIncompleteError extends Error {
    missingBytes;
    totalSize;
    constructor(missingBytes, totalSize) {
        super(`Assembly is incomplete: ${missingBytes} of ${totalSize} bytes missing`);
        this.missingBytes = missingBytes;
        this.totalSize = totalSize;
        this.name = 'AssemblyIncompleteError';
    }
}
exports.AssemblyIncompleteError = AssemblyIncompleteError;
function mergeRanges(ranges) {
    const sorted = ranges
        .filter((range) => range.start >= 0 && range.end >= range.start)
        .map((range) => ({ ...range }))
        .sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [];
    for (const range of sorted) {
        const last = merged[merged.length - 1];
        if (!last || range.start > last.end + 1) {
            merged.push(range);
            continue;
        }
        if (range.end > last.end)
            last.end = range.end;
    }
    return merged;
}
function missingBytes(ranges, total) {
    let covered = 0;
    for (const range of mergeRanges(ranges)) {
        if (range.end < 0 || range.start >= total)
            continue;
        const start = Math.max(0, range.start);
        const end = Math.min(total - 1, range.end);
        if (end >= start)
            covered += end - start + 1;
    }
    return Math.max(0, total - covered);
}
function tokensEqual(expected, provided) {
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length !== b.length)
        return false;
    return crypto_1.default.timingSafeEqual(a, b);
}
/**
 * Owns temporary assembly files and their coverage ledgers.
 */
class AssemblyManager {
    api;
    tempDir;
    maxBytes;
    maxConcurrent;
    inactivityMs;
    retentionMs;
    now;
    jobs = new Map();
    sweepTimer = null;
    constructor(api, workspacePath, options = {}) {
        this.api = api;
        this.tempDir = path_1.default.join(workspacePath, '.tmp', 'assemblies');
        this.maxBytes = options.maxBytes ?? exports.DEFAULT_ASSEMBLY_MAX_BYTES;
        this.maxConcurrent = options.maxConcurrent ?? exports.DEFAULT_ASSEMBLY_MAX_CONCURRENT;
        this.inactivityMs = options.inactivityMs ?? exports.DEFAULT_ASSEMBLY_INACTIVITY_MS;
        this.retentionMs = options.retentionMs ?? exports.DEFAULT_ASSEMBLY_RETENTION_MS;
        this.now = options.now ?? Date.now;
        this.cleanupStaleFiles();
        const sweepInterval = options.sweepIntervalMs ?? exports.DEFAULT_ASSEMBLY_SWEEP_INTERVAL_MS;
        if (sweepInterval > 0) {
            this.sweepTimer = setInterval(() => void this.sweep(), sweepInterval);
            this.sweepTimer.unref?.();
        }
    }
    getActiveCount() {
        return this.jobs.size;
    }
    async createJob(input) {
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
        const jobId = crypto_1.default.randomUUID();
        const token = crypto_1.default.randomBytes(24).toString('hex');
        const filePath = path_1.default.join(this.tempDir, `${TEMP_FILE_PREFIX}${jobId}.part`);
        await fs_1.default.promises.mkdir(this.tempDir, { recursive: true, mode: 0o755 });
        const handle = await fs_1.default.promises.open(filePath, 'w', 0o644);
        try {
            // Preallocate so offset writes are always inside the file.
            await handle.truncate(totalSize);
        }
        catch (error) {
            await handle.close().catch(() => undefined);
            await fs_1.default.promises.unlink(filePath).catch(() => undefined);
            throw error;
        }
        const job = {
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
    async writeChunk(jobId, token, offset, data) {
        const job = this.requireJob(jobId, token);
        if (!Number.isSafeInteger(offset) || offset < 0) {
            throw new AssemblyInvalidError('offset must be a non-negative integer');
        }
        if (!Buffer.isBuffer(data) || data.length === 0) {
            throw new AssemblyInvalidError('chunk body is empty');
        }
        if (offset + data.length > job.totalSize) {
            throw new AssemblyInvalidError(`chunk ${offset}+${data.length} exceeds total size ${job.totalSize}`);
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
    async complete(jobId, token) {
        const job = this.requireJob(jobId, token);
        const missing = missingBytes(job.intervals, job.totalSize);
        if (missing > 0) {
            throw new AssemblyIncompleteError(missing, job.totalSize);
        }
        this.jobs.delete(jobId);
        job.lastActivity = this.now();
        try {
            await job.handle.close();
        }
        catch {
            // The handle may already be closed by a concurrent abort.
        }
        try {
            const result = await this.api.saveFileFromStream({
                stream: fs_1.default.createReadStream(job.filePath),
                mimeType: job.mimeType,
                sourceUrl: job.sourceUrl,
                capturedAt: job.capturedAt,
                maxBytes: job.totalSize,
            });
            return result;
        }
        finally {
            await fs_1.default.promises.unlink(job.filePath).catch(() => undefined);
        }
    }
    async abort(jobId, token) {
        const job = this.jobs.get(jobId);
        if (!job)
            return;
        if (token !== undefined && !tokensEqual(job.token, token)) {
            throw new AssemblyUnauthorizedError();
        }
        this.jobs.delete(jobId);
        await job.handle.close().catch(() => undefined);
        await fs_1.default.promises.unlink(job.filePath).catch(() => undefined);
    }
    async abortAll() {
        const jobs = [...this.jobs.values()];
        this.jobs.clear();
        await Promise.all(jobs.map(async (job) => {
            await job.handle.close().catch(() => undefined);
            await fs_1.default.promises.unlink(job.filePath).catch(() => undefined);
        }));
    }
    async sweep() {
        const cutoff = this.now() - this.inactivityMs;
        for (const job of [...this.jobs.values()]) {
            if (job.lastActivity > cutoff)
                continue;
            console.warn(`[Assembly] Expiring inactive job ${job.id}`);
            await this.abort(job.id).catch(() => undefined);
        }
    }
    close() {
        if (this.sweepTimer) {
            clearInterval(this.sweepTimer);
            this.sweepTimer = null;
        }
        void this.abortAll();
    }
    requireJob(jobId, token) {
        const job = this.jobs.get(jobId);
        if (!job)
            throw new AssemblyNotFoundError(jobId);
        if (!tokensEqual(job.token, token))
            throw new AssemblyUnauthorizedError();
        return job;
    }
    coveredBytes(job) {
        return job.totalSize - missingBytes(job.intervals, job.totalSize);
    }
    cleanupStaleFiles() {
        let entries;
        try {
            entries = fs_1.default.readdirSync(this.tempDir);
        }
        catch {
            return;
        }
        const cutoff = this.now() - this.retentionMs;
        for (const entry of entries) {
            if (!entry.startsWith(TEMP_FILE_PREFIX))
                continue;
            const filePath = path_1.default.join(this.tempDir, entry);
            try {
                const stat = fs_1.default.statSync(filePath);
                if (!stat.isFile() || stat.mtimeMs > cutoff)
                    continue;
                fs_1.default.unlinkSync(filePath);
            }
            catch {
                // Best-effort cleanup.
            }
        }
    }
}
exports.AssemblyManager = AssemblyManager;
//# sourceMappingURL=assembly.js.map