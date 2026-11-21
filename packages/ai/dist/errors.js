"use strict";
/**
 * AI Pipeline Errors
 *
 * Permanent media failures are distinct from transient ones so the task engine
 * can skip a resource that can never succeed instead of retrying it.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnprocessableMediaError = void 0;
exports.isUnprocessableMediaError = isUnprocessableMediaError;
/**
 * Raised when media cannot produce a representative image for the vision
 * model. Retrying the same bytes cannot succeed.
 */
class UnprocessableMediaError extends Error {
    reason;
    hash;
    constructor(reason, message, options = {}) {
        super(message);
        this.name = 'UnprocessableMediaError';
        this.reason = reason;
        this.hash = options.hash;
    }
}
exports.UnprocessableMediaError = UnprocessableMediaError;
function isUnprocessableMediaError(error) {
    return error instanceof UnprocessableMediaError;
}
//# sourceMappingURL=errors.js.map