/**
 * Buffered video assembly primitives shared by the background capture layer.
 *
 * These helpers are deliberately free of Chrome APIs so the completeness
 * rules can be unit tested without a browser. A video is only accepted when
 * the union of observed byte ranges covers the whole resource without gaps.
 */

export type VideoCaptureMode = 'buffer-only' | 're-download';

export const DEFAULT_VIDEO_CAPTURE_MODE: VideoCaptureMode = 're-download';

/**
 * Sites that are known to serve progressive media with signed URLs that are
 * not reliably replayable. They default to buffered capture.
 */
export const DEFAULT_VIDEO_CAPTURE_MODE_BY_HOST: Record<string, VideoCaptureMode> = {
  'douyin.com': 'buffer-only',
  'douyinvod.com': 'buffer-only',
  'v.douyin.com': 'buffer-only',
};

export type VideoAssemblySkipReason =
  | 'playlist'
  | 'in-memory'
  | 'unverified-source'
  | 'unknown-total'
  | 'total-mismatch'
  | 'size-limit'
  | 'truncated'
  | 'aborted'
  | 'body-unavailable'
  | 'incomplete'
  | 'capacity';

/** Inclusive byte interval. */
export interface ByteRange {
  start: number;
  end: number;
}

export interface ContentRange extends ByteRange {
  total: number;
}

const PLAYLIST_MIME_TYPES = new Set([
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
  'application/x-mpeg-url',
  'audio/mpegurl',
  'application/dash+xml',
  'application/vnd.ms-sstr+xml',
]);

const SEGMENT_MIME_TYPES = new Set(['video/iso.segment', 'video/mp2t']);

const SEGMENT_PATH_PATTERN = /\.(?:ts|m4s|cmfv|cmfa|m4f)$/i;

export function normalizeHostSuffix(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\*?\./, '');
}

export function hostMatchesSuffix(host: string, suffix: string): boolean {
  const normalizedHost = host.trim().toLowerCase();
  const normalizedSuffix = normalizeHostSuffix(suffix);
  if (!normalizedHost || !normalizedSuffix) return false;
  return normalizedHost === normalizedSuffix || normalizedHost.endsWith(`.${normalizedSuffix}`);
}

export function resolveVideoCaptureMode(
  pageUrl: string | undefined,
  defaultMode: VideoCaptureMode,
  byHost: Record<string, VideoCaptureMode> | undefined
): VideoCaptureMode {
  if (!pageUrl) return defaultMode;

  let host: string;
  try {
    host = new URL(pageUrl).hostname;
  } catch {
    return defaultMode;
  }

  if (!byHost) return defaultMode;

  // Prefer the most specific suffix so `v.example.com` can override
  // `example.com`.
  let bestSuffix = '';
  let mode = defaultMode;
  for (const [suffix, candidate] of Object.entries(byHost)) {
    if (candidate !== 'buffer-only' && candidate !== 're-download') continue;
    if (!hostMatchesSuffix(host, suffix)) continue;
    if (suffix.length > bestSuffix.length) {
      bestSuffix = suffix;
      mode = candidate;
    }
  }
  return mode;
}

/**
 * Parse `Content-Range: bytes start-end/total`.
 * Returns null for `bytes * /total` or malformed values.
 */
export function parseContentRange(value: string | undefined | null): ContentRange | null {
  if (!value) return null;
  const match = /^bytes\s+(\d+)-(\d+)\/(\d+)$/i.exec(value.trim());
  if (!match) return null;

  const start = Number.parseInt(match[1], 10);
  const end = Number.parseInt(match[2], 10);
  const total = Number.parseInt(match[3], 10);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || !Number.isSafeInteger(total)) {
    return null;
  }
  if (start < 0 || end < start || total <= 0 || end >= total) return null;
  return { start, end, total };
}

export function rangeLength(range: ByteRange): number {
  return Math.max(0, range.end - range.start + 1);
}

/**
 * Merge inclusive ranges into a sorted, non-overlapping list. Adjacent ranges
 * (`[0,9]` and `[10,19]`) merge as well.
 */
export function mergeRanges(ranges: ByteRange[]): ByteRange[] {
  const valid = ranges
    .filter((range) => Number.isSafeInteger(range.start) && Number.isSafeInteger(range.end))
    .filter((range) => range.start >= 0 && range.end >= range.start)
    .map((range) => ({ start: range.start, end: range.end }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: ByteRange[] = [];
  for (const range of valid) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end + 1) {
      merged.push({ ...range });
      continue;
    }
    if (range.end > last.end) last.end = range.end;
  }
  return merged;
}

/** Number of bytes inside `[0, total)` covered by the ranges. */
export function coveredBytes(ranges: ByteRange[], total: number): number {
  if (!Number.isSafeInteger(total) || total <= 0) return 0;
  let covered = 0;
  for (const range of mergeRanges(ranges)) {
    if (range.end < 0 || range.start >= total) continue;
    const start = Math.max(0, range.start);
    const end = Math.min(total - 1, range.end);
    if (end >= start) covered += end - start + 1;
  }
  return covered;
}

export function missingBytes(ranges: ByteRange[], total: number): number {
  if (!Number.isSafeInteger(total) || total <= 0) return total;
  return Math.max(0, total - coveredBytes(ranges, total));
}

export function coversTotal(ranges: ByteRange[], total: number): boolean {
  return Number.isSafeInteger(total) && total > 0 && missingBytes(ranges, total) === 0;
}

/**
 * Return the holes in `[0, total)` after merging the observed ranges.
 * Used only when the optional gap-fill setting is enabled.
 */
export function missingRanges(ranges: ByteRange[], total: number): ByteRange[] {
  if (!Number.isSafeInteger(total) || total <= 0) return [];

  const merged = mergeRanges(ranges)
    .map((range) => ({
      start: Math.max(0, range.start),
      end: Math.min(total - 1, range.end),
    }))
    .filter((range) => range.end >= range.start);

  const holes: ByteRange[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) holes.push({ start: cursor, end: range.start - 1 });
    cursor = Math.max(cursor, range.end + 1);
    if (cursor >= total) break;
  }
  if (cursor < total) holes.push({ start: cursor, end: total - 1 });
  return holes;
}

export function isPlaylistMime(mimeType: string): boolean {
  return PLAYLIST_MIME_TYPES.has(mimeType.trim().toLowerCase());
}

export function isStreamingSegment(mimeType: string, url: string): boolean {
  const mime = mimeType.trim().toLowerCase();
  if (SEGMENT_MIME_TYPES.has(mime)) return true;
  if (!mime.startsWith('video/') && !isPlaylistMime(mime)) return false;
  try {
    return SEGMENT_PATH_PATTERN.test(new URL(url).pathname);
  } catch {
    return SEGMENT_PATH_PATTERN.test(url);
  }
}

export interface BufferedVideoEvaluationInput {
  url: string;
  mimeType: string;
  status?: number;
  contentRange?: string | null;
  contentLength: number;
  enabledVideoTypes: string[];
  maxVideoSize: number;
  minVideoSize: number;
}

export interface BufferedVideoEvaluation {
  eligible: boolean;
  /** Skip silently without producing a user-visible event. */
  silent?: boolean;
  reason?: VideoAssemblySkipReason;
  total?: number;
  range?: ByteRange;
}

/**
 * Decide whether a response can enter the buffered-assembly ledger.
 */
export function evaluateBufferedVideoResponse(
  input: BufferedVideoEvaluationInput
): BufferedVideoEvaluation {
  const { url, mimeType, status, contentRange, contentLength } = input;

  if (!input.enabledVideoTypes.includes(mimeType)) {
    return { eligible: false, silent: true };
  }

  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    return { eligible: false, silent: true };
  }
  if (protocol !== 'http:' && protocol !== 'https:') {
    return { eligible: false, silent: true };
  }

  let total: number;
  let range: ByteRange;

  if (status === 200) {
    total = contentLength;
    if (!Number.isSafeInteger(total) || total <= 0) {
      return { eligible: false, reason: 'unknown-total' };
    }
    range = { start: 0, end: total - 1 };
  } else if (status === 206) {
    const parsed = parseContentRange(contentRange);
    if (!parsed) {
      return { eligible: false, reason: 'unknown-total' };
    }
    total = parsed.total;
    range = { start: parsed.start, end: parsed.end };
  } else {
    return { eligible: false, silent: true };
  }

  if (total < input.minVideoSize) {
    return { eligible: false, reason: 'size-limit', total };
  }
  if (total > input.maxVideoSize) {
    return { eligible: false, reason: 'size-limit', total };
  }

  return { eligible: true, total, range };
}

/**
 * Whether a page media URL and a `<video>.currentSrc` refer to the same
 * resource. Query strings carry volatile signatures and are ignored.
 */
export function matchesMediaUrl(mediaUrl: string, currentSrc: string): boolean {
  if (!mediaUrl || !currentSrc) return false;
  if (currentSrc.startsWith('blob:') || currentSrc.startsWith('data:')) return false;
  try {
    const media = new URL(mediaUrl);
    const source = new URL(currentSrc);
    return media.origin === source.origin && media.pathname === source.pathname;
  } catch {
    return false;
  }
}

export type SourceMatchStrategy = 'exact' | 'stable-id' | 'path';
export type SourceProbeStatus = 'progressive' | 'mse' | 'unverified';
export type SourceEvidenceStrategy = SourceMatchStrategy | 'ranged' | 'repeated-range' | 'page-id';
export type SourceEvidenceDecision = 'accept' | 'retry' | 'mse';

export interface MediaIdentity {
  vid?: string;
  awemeId?: string;
  pathTail?: string;
}

export interface SourceEvidenceInput {
  status?: number;
  contentRange?: string | null;
  distinctRangeCount: number;
  total: number;
  mediaUrl: string;
  pageUrl?: string;
  probeStatus: SourceProbeStatus;
  sources: string[];
}

export interface SourceEvidenceResult {
  decision: SourceEvidenceDecision;
  strategy: SourceEvidenceStrategy | null;
  detail: string;
}

function safeUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function pathTailOf(pathname: string): string | undefined {
  const parts = pathname.split('/').filter(Boolean);
  const tail = parts[parts.length - 1];
  return tail && tail.length >= 16 ? tail : undefined;
}

/**
 * Extract stable identifiers that survive CDN host rotation and re-signing.
 * `__vid` comes from the media URL; `aweme_id` comes from the page URL.
 */
export function extractMediaIdentity(mediaUrl: string, pageUrl?: string): MediaIdentity {
  const media = safeUrl(mediaUrl);
  const page = safeUrl(pageUrl);

  const vid = media?.searchParams.get('__vid') ?? undefined;
  const awemeMatch = page ? /\/video\/(\d+)/.exec(page.pathname) : null;
  const queryId =
    page?.searchParams.get('modal_id') ??
    page?.searchParams.get('aweme_id') ??
    page?.searchParams.get('item_id') ??
    undefined;

  return {
    vid: vid || undefined,
    // A `modal_id` query describes the focused video on a search page and
    // should win over the underlying page path when both exist.
    awemeId: queryId || awemeMatch?.[1] || undefined,
    pathTail: media ? pathTailOf(media.pathname) : undefined,
  };
}

/**
 * Match a media response URL against a page video source using progressively
 * weaker evidence. Blob and data sources never participate.
 */
export function matchMediaSource(
  mediaUrl: string,
  sourceUrl: string,
  pageUrl?: string
): SourceMatchStrategy | null {
  if (!mediaUrl || !sourceUrl) return null;
  if (sourceUrl.startsWith('blob:') || sourceUrl.startsWith('data:')) return null;

  const media = safeUrl(mediaUrl);
  const source = safeUrl(sourceUrl);
  if (!media || !source) return null;

  if (media.origin === source.origin && media.pathname === source.pathname) {
    return 'exact';
  }

  const mediaIdentity = extractMediaIdentity(mediaUrl, pageUrl);
  const sourceIdentity = extractMediaIdentity(sourceUrl);

  if (mediaIdentity.vid && sourceIdentity.vid && mediaIdentity.vid === sourceIdentity.vid) {
    return 'stable-id';
  }
  if (
    mediaIdentity.pathTail &&
    sourceIdentity.pathTail &&
    mediaIdentity.pathTail === sourceIdentity.pathTail
  ) {
    return 'stable-id';
  }

  if (media.pathname === source.pathname) {
    return 'path';
  }

  return null;
}

/**
 * Decide whether a media response belongs to the page's focused media.
 *
 * Returns true when the page exposes a stable id and the media URL carries the
 * same `__vid`; false when both ids exist and differ; null when the page has no
 * stable id or the media URL has no id to compare.
 */
export function isMediaForPage(mediaUrl: string, pageUrl?: string): boolean | null {
  const identity = extractMediaIdentity(mediaUrl, pageUrl);
  if (!identity.awemeId || !identity.vid) return null;
  return identity.vid === identity.awemeId;
}

/**
 * Decide whether a buffered response has enough evidence to enter assembly.
 *
 * Strong network shape wins over the page probe; otherwise the probe and
 * stable identifiers are used. A `retry` result means "skip this response for
 * now, evaluate later responses again" rather than a terminal skip.
 */
export function evaluateSourceEvidence(input: SourceEvidenceInput): SourceEvidenceResult {
  const range = parseContentRange(input.contentRange);
  if (input.status === 206 && range) {
    return {
      decision: 'accept',
      strategy: 'ranged',
      detail: `status=206 range=${range.start}-${range.end}/${range.total}`,
    };
  }

  if (input.distinctRangeCount >= 2 && input.total > 0) {
    return {
      decision: 'accept',
      strategy: 'repeated-range',
      detail: `ranges=${input.distinctRangeCount} total=${input.total}`,
    };
  }

  if (input.probeStatus === 'mse') {
    return {
      decision: 'mse',
      strategy: null,
      detail: `probe=mse sources=${input.sources.length}`,
    };
  }

  const mediaIdentity = extractMediaIdentity(input.mediaUrl, input.pageUrl);
  if (mediaIdentity.vid && mediaIdentity.awemeId && mediaIdentity.vid === mediaIdentity.awemeId) {
    return {
      decision: 'accept',
      strategy: 'page-id',
      detail: `evidence=page-id vid=${mediaIdentity.vid}`,
    };
  }

  let best: SourceMatchStrategy | null = null;
  for (const source of input.sources) {
    const match = matchMediaSource(input.mediaUrl, source, input.pageUrl);
    if (match === 'exact') {
      best = 'exact';
      break;
    }
    if (match === 'stable-id') {
      best = 'stable-id';
      continue;
    }
    if (match === 'path' && !best) {
      best = 'path';
    }
  }

  if (best) {
    return {
      decision: 'accept',
      strategy: best,
      detail: `evidence=${best} sources=${input.sources.length}`,
    };
  }

  return {
    decision: 'retry',
    strategy: null,
    detail: `probe=${input.probeStatus} sources=${input.sources.length}`,
  };
}
