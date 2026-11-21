"use strict";
/**
 * App-side AI media eligibility.
 *
 * Bridges the pure eligibility predicate in `ai` with the metadata and decoder
 * capabilities exposed by `VFSAPI`. The app is the single enforcement point:
 * no enqueue path may create pending AI work for ineligible media.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaEligibilityGate = exports.SKIPPED_MEDIA_ERROR = void 0;
const ai_1 = require("ai");
exports.SKIPPED_MEDIA_ERROR = 'Media format is not supported by the AI vision pipeline';
class MediaEligibilityGate {
    api;
    constructor(api) {
        this.api = api;
    }
    /**
     * Evaluate one hash. Returns null when the media is unknown or deleted so
     * the caller keeps its existing behavior (for example a transient missing
     * blob or a racing upload).
     */
    evaluate(hash) {
        const metadata = this.api.getMetadata(hash);
        if (!metadata || metadata.is_deleted === 1) {
            return null;
        }
        return (0, ai_1.evaluateMediaEligibility)({
            mimeType: metadata.mime_type,
            decodableMimeTypes: this.api.getDecodableImageMimeTypes(),
        });
    }
    /** Reason string when the hash is ineligible, otherwise null. */
    ineligibleReason(hash) {
        const eligibility = this.evaluate(hash);
        return eligibility && !eligibility.eligible ? eligibility.message : null;
    }
    /** MIME types currently present in the index that cannot be AI-processed. */
    ineligibleMimeTypes() {
        const decodable = this.api.getDecodableImageMimeTypes();
        return this.api
            .getDistinctMimeTypes()
            .filter((mimeType) => !(0, ai_1.evaluateMediaEligibility)({ mimeType, decodableMimeTypes: decodable }).eligible);
    }
    /**
     * Enqueue a task, recording a terminal skipped task instead when the media
     * is ineligible. Never creates pending work for ineligible media.
     */
    enqueue(taskType, hash, options = {}) {
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
exports.MediaEligibilityGate = MediaEligibilityGate;
//# sourceMappingURL=media-eligibility.js.map