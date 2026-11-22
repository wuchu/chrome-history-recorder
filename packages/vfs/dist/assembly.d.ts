/**
 * VFS Service - Buffered Video Assembly
 *
 * Accepts byte ranges for a media resource, writes them into a temporary file
 * at their offsets, and only finalizes when every byte of the resource has
 * been received. Incomplete assemblies are discarded; no gap filling or
 * re-downloading happens here.
 */
import type { VFSAPI, SaveFileResult } from './api';
export declare const DEFAULT_ASSEMBLY_MAX_BYTES: number;
export declare const DEFAULT_ASSEMBLY_MAX_CONCURRENT = 8;
export declare const DEFAULT_ASSEMBLY_INACTIVITY_MS: number;
export declare const DEFAULT_ASSEMBLY_RETENTION_MS: number;
export declare const DEFAULT_ASSEMBLY_SWEEP_INTERVAL_MS: number;
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
export declare class AssemblyNotFoundError extends Error {
    constructor(jobId: string);
}
export declare class AssemblyUnauthorizedError extends Error {
    constructor();
}
export declare class AssemblyCapacityError extends Error {
    constructor(limit: number);
}
export declare class AssemblyInvalidError extends Error {
    constructor(message: string);
}
export declare class AssemblyIncompleteError extends Error {
    readonly missingBytes: number;
    readonly totalSize: number;
    constructor(missingBytes: number, totalSize: number);
}
/**
 * Owns temporary assembly files and their coverage ledgers.
 */
export declare class AssemblyManager {
    private readonly api;
    private readonly tempDir;
    private readonly maxBytes;
    private readonly maxConcurrent;
    private readonly inactivityMs;
    private readonly retentionMs;
    private readonly now;
    private readonly jobs;
    private sweepTimer;
    constructor(api: VFSAPI, workspacePath: string, options?: AssemblyManagerOptions);
    getActiveCount(): number;
    createJob(input: AssemblyCreateInput): Promise<AssemblyJobHandle>;
    writeChunk(jobId: string, token: string, offset: number, data: Buffer): Promise<{
        receivedBytes: number;
    }>;
    complete(jobId: string, token: string): Promise<SaveFileResult>;
    abort(jobId: string, token?: string): Promise<void>;
    abortAll(): Promise<void>;
    sweep(): Promise<void>;
    close(): void;
    private requireJob;
    private coveredBytes;
    private cleanupStaleFiles;
}
//# sourceMappingURL=assembly.d.ts.map