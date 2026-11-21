/**
 * AI Media Eligibility
 *
 * Decides whether a media item can produce a representative image for the
 * vision model. The decision is pure and byte-free: it combines the formats the
 * vision model accepts natively with the formats the bundled thumbnail decoder
 * can actually read (supplied by the media layer) plus video.
 */
export declare const NATIVE_VISION_MIME_TYPES: readonly ["image/jpeg", "image/png", "image/webp", "image/gif"];
export interface MediaEligibilityInput {
    mimeType: string;
    /** Image formats the bundled thumbnail decoder can read, from the media layer. */
    decodableMimeTypes: Iterable<string>;
}
export type MediaEligibility = {
    eligible: true;
} | {
    eligible: false;
    reason: 'unsupported-format';
    message: string;
};
export declare function normalizeMimeType(mimeType: string | null | undefined): string;
export declare function isNativeVisionMimeType(mimeType: string | null | undefined): boolean;
export declare function evaluateMediaEligibility(input: MediaEligibilityInput): MediaEligibility;
//# sourceMappingURL=eligibility.d.ts.map