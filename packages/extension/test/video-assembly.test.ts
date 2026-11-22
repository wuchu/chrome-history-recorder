import { describe, it, expect } from 'vitest';
import {
  coversTotal,
  evaluateSourceEvidence,
  extractMediaIdentity,
  isMediaForPage,
  matchMediaSource,
  missingBytes,
  missingRanges,
  coveredBytes,
  evaluateBufferedVideoResponse,
  isPlaylistMime,
  isStreamingSegment,
  matchesMediaUrl,
  mergeRanges,
  parseContentRange,
  resolveVideoCaptureMode,
} from '../src/shared/video-assembly';
import {
  DEFAULT_ENABLED_VIDEO_TYPES,
  DEFAULT_MAX_VIDEO_SIZE,
} from '../src/shared/extension-runtime';
import { classifyVideoSources } from '../src/background/video-source-probe';

describe('parseContentRange', () => {
  it('parses an inclusive range with a total', () => {
    expect(parseContentRange('bytes 10-19/100')).toEqual({ start: 10, end: 19, total: 100 });
  });

  it('rejects unsatisfied and malformed values', () => {
    expect(parseContentRange('bytes */100')).toBeNull();
    expect(parseContentRange('bytes 10-19')).toBeNull();
    expect(parseContentRange('bytes 20-10/100')).toBeNull();
    expect(parseContentRange('bytes 10-100/100')).toBeNull();
    expect(parseContentRange(undefined)).toBeNull();
  });
});

describe('range coverage', () => {
  it('merges overlapping and adjacent ranges', () => {
    expect(
      mergeRanges([
        { start: 20, end: 29 },
        { start: 0, end: 9 },
        { start: 10, end: 19 },
        { start: 25, end: 34 },
      ])
    ).toEqual([{ start: 0, end: 34 }]);
  });

  it('keeps disjoint ranges separate', () => {
    expect(
      mergeRanges([
        { start: 0, end: 9 },
        { start: 20, end: 29 },
      ])
    ).toEqual([
      { start: 0, end: 9 },
      { start: 20, end: 29 },
    ]);
  });

  it('covers a resource when multiple ranges have no gaps', () => {
    const ranges = [
      { start: 50, end: 99 },
      { start: 0, end: 49 },
    ];
    expect(coversTotal(ranges, 100)).toBe(true);
    expect(missingBytes(ranges, 100)).toBe(0);
    expect(coveredBytes(ranges, 100)).toBe(100);
  });

  it('reports missing bytes for a gap', () => {
    const ranges = [
      { start: 0, end: 9 },
      { start: 30, end: 49 },
    ];
    expect(coversTotal(ranges, 50)).toBe(false);
    expect(missingBytes(ranges, 50)).toBe(20);
  });

  it('clips ranges outside the resource', () => {
    expect(
      missingBytes(
        [
          { start: 0, end: 9 },
          { start: 40, end: 80 },
        ],
        50
      )
    ).toBe(30);
  });

  it('ignores invalid ranges', () => {
    expect(
      mergeRanges([
        { start: -10, end: 9 },
        { start: 20, end: 10 },
        { start: 0, end: 9 },
      ])
    ).toEqual([{ start: 0, end: 9 }]);
  });

  it('treats a zero total as uncovered', () => {
    expect(coversTotal([], 0)).toBe(false);
  });
});

describe('resolveVideoCaptureMode', () => {
  const overrides = {
    'douyin.com': 'buffer-only' as const,
    'v.douyin.com': 're-download' as const,
  };

  it('uses the global default when nothing matches', () => {
    expect(resolveVideoCaptureMode('https://example.com/a', 're-download', overrides)).toBe(
      're-download'
    );
  });

  it('matches a host suffix including subdomains', () => {
    expect(
      resolveVideoCaptureMode('https://www.douyin.com/video/1', 're-download', overrides)
    ).toBe('buffer-only');
  });

  it('prefers the most specific suffix', () => {
    expect(resolveVideoCaptureMode('https://v.douyin.com/abc', 'buffer-only', overrides)).toBe(
      're-download'
    );
  });

  it('falls back when the page URL is invalid', () => {
    expect(resolveVideoCaptureMode('not a url', 're-download', overrides)).toBe('re-download');
  });
});

describe('media response classification', () => {
  const base = {
    url: 'https://cdn.example.com/video.mp4',
    mimeType: 'video/mp4',
    enabledVideoTypes: [...DEFAULT_ENABLED_VIDEO_TYPES],
    maxVideoSize: DEFAULT_MAX_VIDEO_SIZE,
    minVideoSize: 1024,
  };

  it('accepts a whole-file 200 response', () => {
    const evaluation = evaluateBufferedVideoResponse({
      ...base,
      status: 200,
      contentLength: 5000,
    });
    expect(evaluation).toEqual({
      eligible: true,
      total: 5000,
      range: { start: 0, end: 4999 },
    });
  });

  it('accepts a ranged response with a parseable total', () => {
    const evaluation = evaluateBufferedVideoResponse({
      ...base,
      status: 206,
      contentRange: 'bytes 1000-1999/5000',
      contentLength: 1000,
    });
    expect(evaluation).toEqual({
      eligible: true,
      total: 5000,
      range: { start: 1000, end: 1999 },
    });
  });

  it('rejects a ranged response without a usable total', () => {
    expect(
      evaluateBufferedVideoResponse({
        ...base,
        status: 206,
        contentRange: 'bytes */5000',
        contentLength: 1000,
      })
    ).toEqual({ eligible: false, reason: 'unknown-total' });
  });

  it('accepts a short clip above the buffered minimum', () => {
    const evaluation = evaluateBufferedVideoResponse({
      ...base,
      minVideoSize: 100 * 1024,
      status: 206,
      contentRange: 'bytes 0-0/776150',
      contentLength: 1,
    });
    expect(evaluation).toMatchObject({ eligible: true, total: 776150 });
  });

  it('rejects resources below the minimum size', () => {
    expect(evaluateBufferedVideoResponse({ ...base, status: 200, contentLength: 100 })).toEqual({
      eligible: false,
      reason: 'size-limit',
      total: 100,
    });
  });

  it('rejects resources above the configured maximum', () => {
    expect(
      evaluateBufferedVideoResponse({
        ...base,
        status: 200,
        contentLength: DEFAULT_MAX_VIDEO_SIZE + 1,
      })
    ).toEqual({ eligible: false, reason: 'size-limit', total: DEFAULT_MAX_VIDEO_SIZE + 1 });
  });

  it('silently ignores disabled MIME types', () => {
    expect(
      evaluateBufferedVideoResponse({
        ...base,
        mimeType: 'image/gif',
        status: 200,
        contentLength: 5000,
      })
    ).toEqual({ eligible: false, silent: true });
  });
});

describe('playlist and segment detection', () => {
  it('recognizes manifests', () => {
    expect(isPlaylistMime('application/vnd.apple.mpegurl')).toBe(true);
    expect(isPlaylistMime('application/dash+xml')).toBe(true);
    expect(isPlaylistMime('video/mp4')).toBe(false);
  });

  it('recognizes streaming segments', () => {
    expect(isStreamingSegment('video/mp2t', 'https://cdn/a.ts')).toBe(true);
    expect(isStreamingSegment('video/iso.segment', 'https://cdn/a')).toBe(true);
    expect(isStreamingSegment('video/mp4', 'https://cdn/a.m4s')).toBe(true);
    expect(isStreamingSegment('video/mp4', 'https://cdn/a.mp4')).toBe(false);
    expect(isStreamingSegment('image/png', 'https://cdn/a.png')).toBe(false);
  });
});

describe('currentSrc matching', () => {
  it('matches on origin and path and ignores the query', () => {
    expect(
      matchesMediaUrl(
        'https://cdn.example.com/v/1.mp4?expire=1&sig=abc',
        'https://cdn.example.com/v/1.mp4?other=2'
      )
    ).toBe(true);
  });

  it('rejects blob and data sources', () => {
    expect(matchesMediaUrl('https://cdn.example.com/v/1.mp4', 'blob:https://a/b')).toBe(false);
    expect(matchesMediaUrl('https://cdn.example.com/v/1.mp4', 'data:video/mp4;base64,AA')).toBe(
      false
    );
  });

  it('rejects a different path', () => {
    expect(
      matchesMediaUrl('https://cdn.example.com/v/1.mp4', 'https://cdn.example.com/v/2.mp4')
    ).toBe(false);
  });
});

describe('video source classification', () => {
  it('treats no video sources as unverified', () => {
    expect(classifyVideoSources([])).toEqual({
      status: 'unverified',
      sources: [],
      hasSrcObject: false,
    });
  });

  it('detects MSE when every source is a blob', () => {
    expect(classifyVideoSources(['blob:https://a/b'])).toEqual({
      status: 'mse',
      sources: ['blob:https://a/b'],
      hasSrcObject: false,
    });
  });

  it('treats an HTTP source as progressive', () => {
    expect(classifyVideoSources(['https://cdn.example.com/v.mp4'])).toEqual({
      status: 'progressive',
      sources: ['https://cdn.example.com/v.mp4'],
      hasSrcObject: false,
    });
  });

  it('treats mixed blob and HTTP sources as progressive', () => {
    expect(classifyVideoSources(['blob:https://a/b', 'https://cdn.example.com/v.mp4']).status).toBe(
      'progressive'
    );
  });

  it('ignores empty entries', () => {
    expect(classifyVideoSources(['', 'https://cdn.example.com/v.mp4']).status).toBe('progressive');
  });

  it('treats an attached MediaSource as MSE even without a current source', () => {
    expect(
      classifyVideoSources([{ src: '', currentSrc: 'blob:https://a/b', hasSrcObject: true }])
    ).toEqual({
      status: 'mse',
      sources: ['blob:https://a/b'],
      hasSrcObject: true,
    });
  });

  it('collects src and currentSrc from the same element', () => {
    expect(
      classifyVideoSources([
        {
          src: 'https://cdn.example.com/v.mp4',
          currentSrc: 'https://cdn.example.com/v.mp4?x=1',
          hasSrcObject: false,
        },
      ]).sources
    ).toEqual(['https://cdn.example.com/v.mp4', 'https://cdn.example.com/v.mp4?x=1']);
  });
});

describe('stable media identity and source matching', () => {
  const longTail = 'o8ETaIsECLfGUGduAfc1';
  const mediaUrl = `https://v95-web-sz.douyinvod.com/4b849/video/tos/cn/${longTail}/?mime_type=video_mp4&__vid=7710926097772479141`;

  it('extracts vid, aweme id and a long path tail', () => {
    expect(
      extractMediaIdentity(mediaUrl, 'https://www.douyin.com/video/7710926097772479141')
    ).toEqual({
      vid: '7710926097772479141',
      awemeId: '7710926097772479141',
      pathTail: longTail,
    });
  });

  it('reads the aweme id from modal_id in a search URL', () => {
    expect(
      extractMediaIdentity(
        mediaUrl,
        'https://www.douyin.com/follow/search/%E5%B1%85%E5%B1%85?modal_id=7710926097772479141&type=general'
      ).awemeId
    ).toBe('7710926097772479141');
  });

  it('ignores short path tails', () => {
    expect(extractMediaIdentity('https://cdn.example.com/v/1.mp4')).toEqual({
      vid: undefined,
      awemeId: undefined,
      pathTail: undefined,
    });
  });

  it('matches an exact URL', () => {
    expect(
      matchMediaSource('https://cdn.example.com/v/1.mp4?x=1', 'https://cdn.example.com/v/1.mp4?x=2')
    ).toBe('exact');
  });

  it('matches a rotated host by path', () => {
    expect(matchMediaSource('https://a.example.com/v/1.mp4', 'https://b.example.com/v/1.mp4')).toBe(
      'path'
    );
  });

  it('matches stable identifiers across different hosts and paths', () => {
    expect(
      matchMediaSource(
        `https://v95.example.com/other/${longTail}/?__vid=42`,
        `https://v3.example.com/different/${longTail}/?__vid=42`
      )
    ).toBe('stable-id');
  });

  it('matches by path tail when the query differs', () => {
    expect(
      matchMediaSource(
        `https://a.example.com/one/${longTail}/?sig=1`,
        `https://b.example.com/two/${longTail}/?sig=2`
      )
    ).toBe('stable-id');
  });

  it('never matches blob or data sources', () => {
    expect(matchMediaSource('https://cdn.example.com/v/1.mp4', 'blob:https://a/b')).toBeNull();
    expect(matchMediaSource('https://cdn.example.com/v/1.mp4', 'data:video/mp4,AA')).toBeNull();
  });
});

describe('source evidence', () => {
  const base = {
    total: 5_000_000,
    mediaUrl:
      'https://v95-web-sz.douyinvod.com/4b849/video/tos/cn/o8ETaIsECLfGUGduAfc1/?mime_type=video_mp4&__vid=7710926097772479141',
    pageUrl: 'https://www.douyin.com/video/7710926097772479141',
    sources: [] as string[],
  };

  it('accepts a ranged response without any probe evidence', () => {
    const result = evaluateSourceEvidence({
      ...base,
      status: 206,
      contentRange: 'bytes 0-1048575/5000000',
      distinctRangeCount: 1,
      probeStatus: 'unverified',
    });
    expect(result.decision).toBe('accept');
    expect(result.strategy).toBe('ranged');
  });

  it('accepts repeated ranges with a stable total', () => {
    const result = evaluateSourceEvidence({
      ...base,
      status: 200,
      distinctRangeCount: 3,
      probeStatus: 'unverified',
    });
    expect(result.decision).toBe('accept');
    expect(result.strategy).toBe('repeated-range');
  });

  it('treats all-blob probes as MSE when there is no strong evidence', () => {
    const result = evaluateSourceEvidence({
      ...base,
      status: 200,
      distinctRangeCount: 1,
      probeStatus: 'mse',
      sources: ['blob:https://www.douyin.com/uuid'],
    });
    expect(result.decision).toBe('mse');
  });

  it('accepts a page-id match when the probe has no usable source', () => {
    const result = evaluateSourceEvidence({
      ...base,
      status: 200,
      distinctRangeCount: 1,
      probeStatus: 'unverified',
    });
    expect(result.decision).toBe('accept');
    expect(result.strategy).toBe('page-id');
  });

  it('accepts a modal_id page identity on a search page', () => {
    const result = evaluateSourceEvidence({
      ...base,
      pageUrl:
        'https://www.douyin.com/follow/search/%E5%B1%85%E5%B1%85?modal_id=7710926097772479141&type=general',
      status: 200,
      distinctRangeCount: 1,
      probeStatus: 'unverified',
    });
    expect(result.decision).toBe('accept');
    expect(result.strategy).toBe('page-id');
  });

  it('accepts an exact source match', () => {
    const result = evaluateSourceEvidence({
      ...base,
      pageUrl: 'https://www.douyin.com/',
      status: 200,
      distinctRangeCount: 1,
      probeStatus: 'progressive',
      sources: [base.mediaUrl],
    });
    expect(result.decision).toBe('accept');
    expect(result.strategy).toBe('exact');
  });

  it('does not accept an unrelated source', () => {
    const result = evaluateSourceEvidence({
      ...base,
      pageUrl: 'https://www.douyin.com/',
      status: 200,
      distinctRangeCount: 1,
      probeStatus: 'progressive',
      sources: ['https://v3-web.douyinvod.com/v/1.mp4'],
    });
    expect(result.decision).toBe('retry');
  });

  it('retries instead of skipping when there is no evidence', () => {
    const result = evaluateSourceEvidence({
      ...base,
      pageUrl: 'https://www.douyin.com/',
      status: 200,
      distinctRangeCount: 1,
      probeStatus: 'unverified',
      sources: [],
    });
    expect(result.decision).toBe('retry');
    expect(result.detail).toContain('probe=unverified');
  });
});

describe('page-scoped media filtering', () => {
  const media =
    'https://v26-web.douyinvod.com/x/y/video/tos/cn/abc/?mime_type=video_mp4&__vid=7709440203223502757';
  const modalPage = 'https://www.douyin.com/search/foo?modal_id=7709440203223502757&type=general';

  it('accepts media whose __vid matches the page modal id', () => {
    expect(isMediaForPage(media, modalPage)).toBe(true);
  });

  it('rejects media whose __vid differs from the page modal id', () => {
    expect(
      isMediaForPage(
        'https://v26-web.douyinvod.com/x/y/video/tos/cn/abc/?mime_type=video_mp4&__vid=7710186721275555321',
        modalPage
      )
    ).toBe(false);
  });

  it('is unknown when the page has no stable media id', () => {
    expect(isMediaForPage(media, 'https://www.douyin.com/search/foo?type=general')).toBeNull();
  });

  it('is unknown when the media URL has no __vid', () => {
    expect(
      isMediaForPage('https://v26-web.douyinvod.com/x/y/video/tos/cn/abc/', modalPage)
    ).toBeNull();
  });
});

describe('missingRanges', () => {
  it('returns the head gap when capture started mid-video', () => {
    expect(missingRanges([{ start: 8_142_180, end: 15_550_562 }], 15_550_563)).toEqual([
      { start: 0, end: 8_142_179 },
    ]);
  });

  it('returns middle and tail gaps', () => {
    expect(
      missingRanges(
        [
          { start: 0, end: 9 },
          { start: 20, end: 29 },
        ],
        40
      )
    ).toEqual([
      { start: 10, end: 19 },
      { start: 30, end: 39 },
    ]);
  });

  it('returns nothing when coverage is complete', () => {
    expect(
      missingRanges(
        [
          { start: 0, end: 9 },
          { start: 10, end: 19 },
        ],
        20
      )
    ).toEqual([]);
  });

  it('clips ranges outside the resource', () => {
    expect(missingRanges([{ start: 5, end: 100 }], 20)).toEqual([{ start: 0, end: 4 }]);
  });
});
