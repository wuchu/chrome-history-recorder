/**
 * App-side AI media eligibility.
 *
 * Bridges the pure eligibility predicate in `ai` with the metadata and decoder
 * capabilities exposed by `VFSAPI`. The app is the single enforcement point:
 * no enqueue path may create pending AI work for ineligible media.
 */
import { type MediaEligibility } from 'ai';
import type { TaskType } from 'vfs';
export declare const SKIPPED_MEDIA_ERROR = "Media format is not supported by the AI vision pipeline";
export interface EligibilityMediaRecord {
    mime_type: string;
    is_deleted?: number;
}
export interface EligibilityApi {
    getMetadata(hash: string): EligibilityMediaRecord | null;
    getDistinctMimeTypes(): string[];
    getDecodableImageMimeTypes(): string[];
    recordSkippedTask(params: {
        taskType: TaskType;
        hash: string;
        error: string;
        priority?: number;
        maxAttempts?: number;
    }): {
        success: boolean;
    };
    enqueueTask(params: {
        taskType: TaskType;
        hash: string;
        priority?: number;
        maxAttempts?: number;
        requeue?: boolean;
    }): {
        success: boolean;
    };
}
export interface EnqueueOptions {
    priority?: number;
    maxAttempts?: number;
    requeue?: boolean;
}
export interface EnqueueWithEligibilityResult {
    success: boolean;
    skipped: boolean;
    reason?: string;
}
export declare class MediaEligibilityGate {
    private readonly api;
    constructor(api: EligibilityApi);
    /**
     * Evaluate one hash. Returns null when the media is unknown or deleted so
     * the caller keeps its existing behavior (for example a transient missing
     * blob or a racing upload).
     */
    evaluate(hash: string): MediaEligibility | null;
    /** Reason string when the hash is ineligible, otherwise null. */
    ineligibleReason(hash: string): string | null;
    /** MIME types currently present in the index that cannot be AI-processed. */
    ineligibleMimeTypes(): string[];
    /**
     * Enqueue a task, recording a terminal skipped task instead when the media
     * is ineligible. Never creates pending work for ineligible media.
     */
    enqueue(taskType: TaskType, hash: string, options?: EnqueueOptions): EnqueueWithEligibilityResult;
}
//# sourceMappingURL=media-eligibility.d.ts.map