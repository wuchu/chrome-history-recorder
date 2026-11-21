import { describe, expect, it } from 'vitest';
import {
  NATIVE_VISION_MIME_TYPES,
  evaluateMediaEligibility,
  isNativeVisionMimeType,
  normalizeMimeType,
} from '../src/eligibility';

const DECODABLE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff'];

describe('AI media eligibility', () => {
  it('accepts native vision formats', () => {
    for (const mimeType of NATIVE_VISION_MIME_TYPES) {
      expect(evaluateMediaEligibility({ mimeType, decodableMimeTypes: [] })).toEqual({
        eligible: true,
      });
    }
  });

  it('accepts formats the bundled thumbnail decoder can read', () => {
    expect(
      evaluateMediaEligibility({ mimeType: 'image/tiff', decodableMimeTypes: DECODABLE })
    ).toEqual({ eligible: true });
  });

  it('accepts video subject to runtime frame extraction', () => {
    expect(evaluateMediaEligibility({ mimeType: 'video/mp4', decodableMimeTypes: [] })).toEqual({
      eligible: true,
    });
  });

  it('rejects formats with no decodable path', () => {
    for (const mimeType of ['image/x-icon', 'image/vnd.microsoft.icon', 'image/bmp']) {
      const result = evaluateMediaEligibility({ mimeType, decodableMimeTypes: DECODABLE });
      expect(result.eligible).toBe(false);
      if (result.eligible) throw new Error('unreachable');
      expect(result.reason).toBe('unsupported-format');
      expect(result.message).toContain(mimeType);
    }
  });

  it('normalizes MIME parameters and casing', () => {
    expect(normalizeMimeType(' Image/PNG ; charset=binary')).toBe('image/png');
    expect(isNativeVisionMimeType('IMAGE/PNG')).toBe(true);
    expect(
      evaluateMediaEligibility({
        mimeType: 'IMAGE/TIFF; charset=binary',
        decodableMimeTypes: DECODABLE,
      })
    ).toEqual({ eligible: true });
  });

  it('rejects media without a MIME type', () => {
    const result = evaluateMediaEligibility({ mimeType: '', decodableMimeTypes: DECODABLE });
    expect(result.eligible).toBe(false);
    expect(result.eligible === false && result.reason).toBe('unsupported-format');
  });
});
