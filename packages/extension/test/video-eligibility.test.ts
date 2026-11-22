/**
 * Video candidate eligibility rules.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeResource,
  evaluateVideoResponse,
  resolveMimeType,
  type CaptureConfig,
} from '../src/background/debugger-capture';
import {
  DEFAULT_ENABLED_VIDEO_TYPES,
  DEFAULT_MAX_VIDEO_SIZE,
} from '../src/shared/extension-runtime';

const config: CaptureConfig = {
  captureVideos: true,
  maxVideoSize: DEFAULT_MAX_VIDEO_SIZE,
  enabledVideoTypes: [...DEFAULT_ENABLED_VIDEO_TYPES],
  videoCaptureMode: 're-download',
  videoCaptureModeByHost: {},
};

const baseInput = {
  url: 'https://cdn.example.com/video.mp4',
  mimeType: 'video/mp4',
  status: 200,
  headers: { 'content-length': '22925673' },
  contentLength: 22925673,
  config,
  seenUrls: new Set<string>(),
};

describe('resolveMimeType', () => {
  it('prefers a specific content-type header', () => {
    expect(resolveMimeType('video/mp4; codecs=avc1', undefined, baseInput.url)).toBe('video/mp4');
  });

  it('falls back to the sniffed type when the header is generic', () => {
    expect(resolveMimeType('application/octet-stream', 'video/mp4', baseInput.url)).toBe(
      'video/mp4'
    );
  });

  it('infers video types from the URL when metadata is missing', () => {
    expect(resolveMimeType(undefined, undefined, 'https://cdn.example.com/clip.webm')).toBe(
      'video/webm'
    );
  });

  it('returns null for an unrecognized resource', () => {
    expect(resolveMimeType(undefined, undefined, 'https://cdn.example.com/blob')).toBeNull();
  });
});

describe('analyzeResource', () => {
  it('reports the content length of a 200 response', () => {
    expect(analyzeResource(200, { 'content-length': '100' }, 100)).toEqual({
      ranged: false,
      totalSize: 100,
    });
  });

  it('reports the total size of a full-range 206', () => {
    expect(
      analyzeResource(206, { 'content-range': 'bytes 0-22925672/22925673' }, 22925673)
    ).toEqual({ ranged: true, totalSize: 22925673 });
  });

  it('reports the complete resource size of a partial 206', () => {
    expect(analyzeResource(206, { 'content-range': 'bytes 0-1023/22925673' }, 1024)).toEqual({
      ranged: true,
      totalSize: 22925673,
    });
  });

  it('reports a 206 without a content range as unranged', () => {
    expect(analyzeResource(206, {}, 1024)).toEqual({ ranged: false, totalSize: 1024 });
  });
});

describe('evaluateVideoResponse', () => {
  it('accepts a complete mp4 response', () => {
    const result = evaluateVideoResponse(baseInput);
    expect(result.eligible).toBe(true);
    expect(result.totalSize).toBe(22925673);
  });

  it('accepts a full-range 206 response', () => {
    const result = evaluateVideoResponse({
      ...baseInput,
      status: 206,
      headers: { 'content-range': 'bytes 0-22925672/22925673' },
    });
    expect(result.eligible).toBe(true);
    expect(result.totalSize).toBe(22925673);
  });

  it('accepts a partial 206 and uses the full resource size', () => {
    const result = evaluateVideoResponse({
      ...baseInput,
      status: 206,
      headers: { 'content-range': 'bytes 0-1023/22925673' },
      contentLength: 1024,
    });
    expect(result.eligible).toBe(true);
    expect(result.totalSize).toBe(22925673);
  });

  it('skips a 206 without a usable content range', () => {
    const result = evaluateVideoResponse({
      ...baseInput,
      status: 206,
      headers: {},
      contentLength: 1024,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Content-Range');
  });

  it('skips a non-2xx response', () => {
    const result = evaluateVideoResponse({ ...baseInput, status: 304 });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('status');
  });

  it('skips a video below the minimum size', () => {
    const result = evaluateVideoResponse({
      ...baseInput,
      headers: { 'content-length': '2048' },
      contentLength: 2048,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('smaller');
  });

  it('skips a video above the configured maximum size', () => {
    const result = evaluateVideoResponse({
      ...baseInput,
      config: { ...config, maxVideoSize: 1024 * 1024 },
      headers: { 'content-length': String(2 * 1024 * 1024) },
      contentLength: 2 * 1024 * 1024,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('larger');
  });

  it('ignores formats that are not enabled', () => {
    const result = evaluateVideoResponse({
      ...baseInput,
      mimeType: 'video/quicktime',
      config: { ...config, enabledVideoTypes: ['video/mp4'] },
    });
    expect(result.eligible).toBe(false);
    expect(result.silent).toBe(true);
  });

  it('ignores a blob URL', () => {
    const result = evaluateVideoResponse({ ...baseInput, url: 'blob:https://example.com/abc' });
    expect(result.eligible).toBe(false);
    expect(result.silent).toBe(true);
  });

  it('ignores a repeated URL', () => {
    const seenUrls = new Set([baseInput.url]);
    const result = evaluateVideoResponse({ ...baseInput, seenUrls });
    expect(result.eligible).toBe(false);
    expect(result.silent).toBe(true);
  });

  it('ignores all videos when video capture is disabled', () => {
    const result = evaluateVideoResponse({
      ...baseInput,
      config: { ...config, captureVideos: false },
    });
    expect(result.eligible).toBe(false);
    expect(result.silent).toBe(true);
  });

  it('does not impose a per-page candidate cap', () => {
    const seenUrls = new Set(
      Array.from({ length: 100 }, (_, index) => `https://cdn.example.com/clip-${index}.mp4`)
    );
    const result = evaluateVideoResponse({ ...baseInput, seenUrls });
    expect(result.eligible).toBe(true);
  });
});
