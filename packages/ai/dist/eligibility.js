"use strict";
/**
 * AI Media Eligibility
 *
 * Decides whether a media item can produce a representative image for the
 * vision model. The decision is pure and byte-free: it combines the formats the
 * vision model accepts natively with the formats the bundled thumbnail decoder
 * can actually read (supplied by the media layer) plus video.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NATIVE_VISION_MIME_TYPES = void 0;
exports.normalizeMimeType = normalizeMimeType;
exports.isNativeVisionMimeType = isNativeVisionMimeType;
exports.evaluateMediaEligibility = evaluateMediaEligibility;
exports.NATIVE_VISION_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
];
const NATIVE_VISION_SET = new Set(exports.NATIVE_VISION_MIME_TYPES);
function normalizeMimeType(mimeType) {
    return (mimeType ?? '').split(';', 1)[0].trim().toLowerCase();
}
function isNativeVisionMimeType(mimeType) {
    return NATIVE_VISION_SET.has(normalizeMimeType(mimeType));
}
function evaluateMediaEligibility(input) {
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
//# sourceMappingURL=eligibility.js.map