/**
 * App-side AI media eligibility.
 *
 * Bridges the pure eligibility predicate in `ai` with the metadata and decoder
 * capabilities exposed by `VFSAPI`. The app is the single enforcement point:
 * no enqueue path may create pending AI work for ineligible media.
 */

import { evaluateMediaEligibility, type MediaEligibility } from 'ai';
import type { TaskType } from 'vfs';

export const SKIPPED_MEDIA_ERROR = 'Media format is not supported by the AI vision pipeline';

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
  }): { success: boolean };
  enqueueTask(params: {
    taskType: TaskType;
    hash: string;
    priority?: number;
    maxAttempts?: number;
    requeue?: boolean;
  }): { success: boolean };
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

export class MediaEligibilityGate {
  private readonly api: EligibilityApi;

  constructor(api: EligibilityApi) {
    this.api = api;
  }

  /**
   * Evaluate one hash. Returns null when the media is unknown or deleted so
   * the caller keeps its existing behavior (for example a transient missing
   * blob or a racing upload).
   */
  evaluate(hash: string): MediaEligibility | null {
    const metadata = this.api.getMetadata(hash);
    if (!metadata || metadata.is_deleted === 1) {
      return null;
    }
    return evaluateMediaEligibility({
      mimeType: metadata.mime_type,
      decodableMimeTypes: this.api.getDecodableImageMimeTypes(),
    });
  }

  /** Reason string when the hash is ineligible, otherwise null. */
  ineligibleReason(hash: string): string | null {
    const eligibility = this.evaluate(hash);
    return eligibility && !eligibility.eligible ? eligibility.message : null;
  }

  /** MIME types currently present in the index that cannot be AI-processed. */
  ineligibleMimeTypes(): string[] {
    const decodable = this.api.getDecodableImageMimeTypes();
    return this.api
      .getDistinctMimeTypes()
      .filter(
        (mimeType) =>
          !evaluateMediaEligibility({ mimeType, decodableMimeTypes: decodable }).eligible
      );
  }

  /**
   * Enqueue a task, recording a terminal skipped task instead when the media
   * is ineligible. Never creates pending work for ineligible media.
   */
  enqueue(
    taskType: TaskType,
    hash: string,
    options: EnqueueOptions = {}
  ): EnqueueWithEligibilityResult {
    const reason = this.ineligibleReason(hash);
    if (reason) {
      const result = this.api.recordSkippedTask({
        taskType,
        hash,
        error: reason,
        priority: options.priority,
        maxAttempts: options.maxAttempts,
      });
      return { success: result.success, skipped: true, reason };
    }

    const result = this.api.enqueueTask({
      taskType,
      hash,
      priority: options.priority,
      maxAttempts: options.maxAttempts,
      requeue: options.requeue,
    });
    return { success: result.success, skipped: false };
  }
}
