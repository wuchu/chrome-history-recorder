/**
 * AI Pipeline Errors
 *
 * Permanent media failures are distinct from transient ones so the task engine
 * can skip a resource that can never succeed instead of retrying it.
 */

export type UnprocessableMediaReason =
  | 'unsupported-format'
  | 'no-representative-frame'
  | 'invalid-media';

/**
 * Raised when media cannot produce a representative image for the vision
 * model. Retrying the same bytes cannot succeed.
 */
export class UnprocessableMediaError extends Error {
  readonly reason: UnprocessableMediaReason;
  readonly hash?: string;

  constructor(reason: UnprocessableMediaReason, message: string, options: { hash?: string } = {}) {
    super(message);
    this.name = 'UnprocessableMediaError';
    this.reason = reason;
    this.hash = options.hash;
  }
}

export function isUnprocessableMediaError(error: unknown): error is UnprocessableMediaError {
  return error instanceof UnprocessableMediaError;
}
