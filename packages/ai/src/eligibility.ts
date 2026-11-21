/**
 * AI Media Eligibility
 *
 * Decides whether a media item can produce a representative image for the
 * vision model. The decision is pure and byte-free: it combines the formats the
 * vision model accepts natively with the formats the bundled thumbnail decoder
 * can actually read (supplied by the media layer) plus video.
 */

export const NATIVE_VISION_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

const NATIVE_VISION_SET = new Set<string>(NATIVE_VISION_MIME_TYPES);

export interface MediaEligibilityInput {
  mimeType: string;
  /** Image formats the bundled thumbnail decoder can read, from the media layer. */
  decodableMimeTypes: Iterable<string>;
}

export type MediaEligibility =
  | { eligible: true }
  | { eligible: false; reason: 'unsupported-format'; message: string };

export function normalizeMimeType(mimeType: string | null | undefined): string {
  return (mimeType ?? '').split(';', 1)[0].trim().toLowerCase();
}

export function isNativeVisionMimeType(mimeType: string | null | undefined): boolean {
  return NATIVE_VISION_SET.has(normalizeMimeType(mimeType));
}

export function evaluateMediaEligibility(input: MediaEligibilityInput): MediaEligibility {
  const mimeType = normalizeMimeType(input.mimeType);

  if (!mimeType) {
    return {
      eligible: false,
      reason: 'unsupported-format',
      message: 'Media has no MIME type; AI vision cannot process it',
    };
  }

  if (isNativeVisionMimeType(mimeType) || mimeType.startsWith('video/')) {
    return { eligible: true };
  }

  const decodable = new Set(Array.from(input.decodableMimeTypes, normalizeMimeType));
  if (decodable.has(mimeType)) {
    return { eligible: true };
  }

  return {
    eligible: false,
    reason: 'unsupported-format',
    message: `Media format ${mimeType} is not supported by the AI vision pipeline`,
  };
}
