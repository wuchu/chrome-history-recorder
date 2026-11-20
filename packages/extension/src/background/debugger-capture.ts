import type { FileManager } from './file-manager';
import {
  DEFAULT_ENABLED_VIDEO_TYPES,
  DEFAULT_MAX_VIDEO_SIZE,
  type ExtensionConfig,
} from '../shared/extension-runtime';
import { getExistingVideoDownloadManager } from './video-download';
import { getCaptureSessionStore } from './capture-session';

type CaptureStatus = 'idle' | 'capturing' | 'error';

export interface CaptureState {
  tabId: number;
  isEnabled: boolean;
  status: CaptureStatus;
  debuggerAttached: boolean;
  captureCount: number;
  skippedCount: number;
  failedCount: number;
  lastCaptureTime?: string;
  error?: string;
}

interface CandidateRequest {
  requestId: string;
  tabId: number;
  url: string;
  mimeType: string;
  size: number;
  capturedAt: string;
  pageUrl: string;
}

/**
 * A detected direct video resource to be downloaded by the video pipeline.
 */
export interface VideoCandidate {
  tabId: number;
  url: string;
  mimeType: string;
  size: number;
  maxBytes: number;
  capturedAt: string;
  pageUrl?: string;
}

interface CdpResponse {
  url?: string;
  headers?: Record<string, unknown>;
  mimeType?: string;
  status?: number;
}

interface CdpEventParams {
  requestId?: string;
  response?: CdpResponse;
}

interface CaptureDependencies {
  getFileManager: () => FileManager;
  onVideoCandidate?: (candidate: VideoCandidate) => void;
}

export interface CaptureConfig {
  captureVideos: boolean;
  maxVideoSize: number;
  enabledVideoTypes: string[];
}

const DEBUGGER_PROTOCOL_VERSION = '1.3';
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const MIN_IMAGE_SIZE = 10 * 1024;
const MIN_VIDEO_SIZE = 1 * 1024 * 1024;
const MAX_VIDEO_SKIP_EVENTS_PER_PAGE = 10;
const SVG_MIME_TYPE = 'image/svg+xml';
const GENERIC_MIME_TYPES = new Set(['application/octet-stream', 'binary/octet-stream']);
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function normalizeHeaders(headers: Record<string, unknown> | undefined): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (!headers) return normalized;

  for (const [name, value] of Object.entries(headers)) {
    normalized[name.toLowerCase()] = String(value);
  }

  return normalized;
}

function getHeader(headers: Record<string, string>, name: string): string | undefined {
  return headers[name.toLowerCase()];
}

function stripMimeParameters(mimeType: string): string {
  return mimeType.split(';', 1)[0].trim().toLowerCase();
}

function inferMimeType(url: string): string | null {
  const pathname = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  })();

  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.gif')) return 'image/gif';
  if (pathname.endsWith('.bmp')) return 'image/bmp';
  if (pathname.endsWith('.tif') || pathname.endsWith('.tiff')) return 'image/tiff';
  if (pathname.endsWith('.ico')) return 'image/x-icon';
  if (pathname.endsWith('.svg')) return SVG_MIME_TYPE;
  if (pathname.endsWith('.mp4') || pathname.endsWith('.m4v')) return 'video/mp4';
  if (pathname.endsWith('.webm')) return 'video/webm';
  if (pathname.endsWith('.mov')) return 'video/quicktime';
  if (pathname.endsWith('.avi')) return 'video/x-msvideo';
  if (pathname.endsWith('.ogv')) return 'video/ogg';
  if (pathname.endsWith('.mkv')) return 'video/x-matroska';
  return null;
}

/**
 * Resolve the media type, preferring the response header but falling back to
 * the debugger-reported type when the header is missing or generic.
 */
export function resolveMimeType(
  headerMimeType: string | undefined,
  sniffedMimeType: string | undefined,
  url: string
): string | null {
  const header = headerMimeType ? stripMimeParameters(headerMimeType) : '';
  const sniffed = sniffedMimeType ? stripMimeParameters(sniffedMimeType) : '';

  if (header && !GENERIC_MIME_TYPES.has(header)) return header;
  if (sniffed && !GENERIC_MIME_TYPES.has(sniffed)) return sniffed;
  if (header) return header;
  if (sniffed) return sniffed;
  return inferMimeType(url);
}

interface ResourceRange {
  start: number;
  end: number;
  total: number;
}

function parseContentRange(headers: Record<string, string>): ResourceRange | null {
  const contentRange = getHeader(headers, 'content-range');
  if (!contentRange) return null;

  const match = /^bytes\s+(\d+)-(\d+)\/(\d+)$/i.exec(contentRange.trim());
  if (!match) return null;

  return {
    start: Number.parseInt(match[1], 10),
    end: Number.parseInt(match[2], 10),
    total: Number.parseInt(match[3], 10),
  };
}

/**
 * Determine the total resource size and whether the response carried a byte
 * range. A ranged response still identifies a resource that can be fetched in
 * full without a `Range` header.
 */
export function analyzeResource(
  _status: number | undefined,
  headers: Record<string, string>,
  contentLength: number
): { ranged: boolean; totalSize: number } {
  const range = parseContentRange(headers);
  if (range) {
    return { ranged: true, totalSize: range.total };
  }

  return { ranged: false, totalSize: contentLength };
}

export interface VideoEvaluationInput {
  url: string;
  mimeType: string;
  status?: number;
  headers: Record<string, string>;
  contentLength: number;
  config: CaptureConfig;
  seenUrls: Set<string>;
}

export interface VideoEvaluation {
  eligible: boolean;
  /** Skip silently without broadcasting a reason. */
  silent?: boolean;
  reason?: string;
  totalSize: number;
}

/**
 * Decide whether a detected video response should become a download candidate.
 */
export function evaluateVideoResponse(input: VideoEvaluationInput): VideoEvaluation {
  const { url, mimeType, status, headers, contentLength, config, seenUrls } = input;
  const { ranged, totalSize } = analyzeResource(status, headers, contentLength);

  if (!config.captureVideos) {
    return { eligible: false, silent: true, totalSize };
  }

  if (!config.enabledVideoTypes.includes(mimeType)) {
    return { eligible: false, silent: true, totalSize };
  }

  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    return { eligible: false, silent: true, totalSize };
  }

  if (protocol !== 'http:' && protocol !== 'https:') {
    return { eligible: false, silent: true, totalSize };
  }

  // A 200 response is complete; a 206 response is a byte range of the same
  // resource. Both identify a downloadable resource — the pipeline always
  // fetches the URL in full without a Range header. A 206 without a usable
  // Content-Range leaves the total size unknown, so it is not a candidate.
  if (status !== 200 && status !== 206) {
    return {
      eligible: false,
      reason: `Unsupported video response status ${status ?? 'unknown'}`,
      totalSize,
    };
  }

  if (status === 206 && !ranged) {
    return {
      eligible: false,
      reason: 'Partial video response without a usable Content-Range',
      totalSize,
    };
  }

  if (totalSize > 0 && totalSize < MIN_VIDEO_SIZE) {
    return {
      eligible: false,
      reason: `Video smaller than ${MIN_VIDEO_SIZE} bytes`,
      totalSize,
    };
  }

  if (totalSize > config.maxVideoSize) {
    return {
      eligible: false,
      reason: `Video larger than ${config.maxVideoSize} bytes`,
      totalSize,
    };
  }

  if (seenUrls.has(url)) {
    return { eligible: false, silent: true, totalSize };
  }

  return { eligible: true, totalSize };
}

function decodeBody(body: string, base64Encoded: boolean): number[] {
  if (!base64Encoded) {
    return Array.from(new TextEncoder().encode(body));
  }

  const binary = atob(body);
  const bytes = new Array<number>(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class DebuggerCaptureController {
  private states = new Map<number, CaptureState>();
  private candidates = new Map<string, CandidateRequest>();
  private videoUrls = new Map<number, Set<string>>();
  private videoSkipEvents = new Map<number, number>();
  private config: CaptureConfig;
  private readonly dependencies: CaptureDependencies;
  private readonly boundDebuggerEvent = this.handleDebuggerEvent.bind(this);
  private readonly boundDebuggerDetach = this.handleDebuggerDetach.bind(this);
  private readonly boundTabRemoved = this.handleTabRemoved.bind(this);
  private readonly boundTabUpdated = this.handleTabUpdated.bind(this);

  constructor(dependencies: CaptureDependencies, config?: Partial<CaptureConfig>) {
    this.dependencies = dependencies;
    this.config = {
      captureVideos: config?.captureVideos ?? true,
      maxVideoSize: config?.maxVideoSize ?? DEFAULT_MAX_VIDEO_SIZE,
      enabledVideoTypes: config?.enabledVideoTypes ?? [...DEFAULT_ENABLED_VIDEO_TYPES],
    };
  }

  /**
   * Apply updated video capture settings without restarting capture.
   */
  updateConfig(
    config: Pick<ExtensionConfig, 'captureVideos' | 'maxVideoSize' | 'enabledVideoTypes'>
  ): void {
    this.config = {
      captureVideos: config.captureVideos,
      maxVideoSize: config.maxVideoSize,
      enabledVideoTypes: config.enabledVideoTypes,
    };
  }

  initialize(): void {
    chrome.debugger.onEvent.addListener(this.boundDebuggerEvent);
    chrome.debugger.onDetach.addListener(this.boundDebuggerDetach);
    chrome.tabs.onRemoved.addListener(this.boundTabRemoved);
    chrome.tabs.onUpdated.addListener(this.boundTabUpdated);
  }

  getState(tabId: number): CaptureState {
    return this.ensureState(tabId);
  }

  /**
   * Rehydrate the controller after a service-worker restart while the
   * debugger attachment and capture session are still valid.
   */
  restoreActiveSession(tabId: number): void {
    const state = this.ensureState(tabId);
    state.isEnabled = true;
    state.status = 'capturing';
    state.debuggerAttached = true;
    state.error = undefined;
    void this.enableNetwork(tabId).catch((error) => {
      const message =
        error instanceof Error ? error.message : 'Failed to re-enable Network after restore';
      state.status = 'error';
      state.error = message;
      getCaptureSessionStore().end('error', message);
      this.broadcastError(tabId, message);
      this.broadcastState(tabId);
    });
    this.broadcastState(tabId);
  }

  async start(tabId: number): Promise<CaptureState> {
    const store = getCaptureSessionStore();
    const activeSession = store.getActiveSession();

    // A new session replaces the current one. The UI asks for confirmation
    // before sending this request; the Background still enforces the invariant.
    if (activeSession && activeSession.tabId !== tabId) {
      await this.stop(activeSession.tabId);
    }

    const state = this.ensureState(tabId);
    if (activeSession?.tabId === tabId && state.isEnabled) {
      return { ...state };
    }

    state.isEnabled = true;
    state.status = 'capturing';
    state.error = undefined;
    state.captureCount = 0;
    state.skippedCount = 0;
    state.failedCount = 0;
    state.lastCaptureTime = undefined;

    try {
      if (!state.debuggerAttached) {
        try {
          await chrome.debugger.attach({ tabId }, DEBUGGER_PROTOCOL_VERSION);
          state.debuggerAttached = true;
        } catch (attachError) {
          const attachMessage =
            attachError instanceof Error ? attachError.message : String(attachError);
          // After a service-worker restart the attachment may still be live
          // even though this controller instance no longer has state for it.
          if (/already attached/i.test(attachMessage)) {
            state.debuggerAttached = true;
          } else {
            throw attachError;
          }
        }
      }

      await this.enableNetwork(tabId);

      const tab = await chrome.tabs.get(tabId).catch(() => null);
      const pageUrl = tab?.url ?? '';
      store.start({
        tabId,
        windowId: tab?.windowId,
        tabTitle: tab?.title ?? '',
        pageUrl,
        origin: getOrigin(pageUrl),
      });

      this.broadcastState(tabId);
      return { ...state };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start capture';
      state.status = 'error';
      state.error = message;
      if (state.debuggerAttached) {
        try {
          await chrome.debugger.detach({ tabId });
        } catch {
          // The attachment may already be gone.
        }
      }
      state.debuggerAttached = false;
      state.isEnabled = false;
      this.broadcastError(tabId, message);
      this.broadcastState(tabId);
      return { ...state };
    }
  }

  async stop(tabId: number): Promise<CaptureState> {
    const state = this.ensureState(tabId);
    state.isEnabled = false;
    state.status = 'idle';
    state.error = undefined;

    this.clearCandidatesForTab(tabId);
    this.clearVideoUrlsForTab(tabId);
    getExistingVideoDownloadManager()?.cancelTab(tabId);

    if (state.debuggerAttached) {
      try {
        await chrome.debugger.detach({ tabId });
      } catch (error) {
        console.warn('[DebuggerCapture] detach failed:', error);
      }
    }

    state.debuggerAttached = false;

    const store = getCaptureSessionStore();
    if (store.getActiveSession()?.tabId === tabId) {
      store.end('stopped');
    }

    this.broadcastState(tabId);
    return { ...state };
  }

  private ensureState(tabId: number): CaptureState {
    const existing = this.states.get(tabId);
    if (existing) return existing;

    const state: CaptureState = {
      tabId,
      isEnabled: false,
      status: 'idle',
      debuggerAttached: false,
      captureCount: 0,
      skippedCount: 0,
      failedCount: 0,
    };
    this.states.set(tabId, state);
    return state;
  }

  private handleDebuggerEvent(
    source: chrome.debugger.Debuggee,
    method: string,
    params?: CdpEventParams
  ): void {
    if (typeof source.tabId !== 'number') return;
    const state = this.states.get(source.tabId);
    if (!state?.isEnabled) return;

    if (method === 'Network.responseReceived') {
      this.handleResponseReceived(source.tabId, params);
    } else if (method === 'Network.loadingFinished') {
      void this.handleLoadingFinished(source.tabId, params);
    } else if (method === 'Network.loadingFailed') {
      this.handleLoadingFailed(source.tabId, params);
    }
  }

  private handleResponseReceived(tabId: number, params?: CdpEventParams): void {
    const requestId = params?.requestId;
    const response = params?.response;
    const url = response?.url;
    if (!requestId || !url || url.startsWith('data:') || url.startsWith('blob:')) return;

    const headers = normalizeHeaders(response?.headers);
    const mimeType = resolveMimeType(getHeader(headers, 'content-type'), response?.mimeType, url);
    if (!mimeType) return;

    const contentLength = Number.parseInt(getHeader(headers, 'content-length') ?? '0', 10) || 0;

    if (mimeType.startsWith('video/')) {
      this.handleVideoResponse(tabId, url, mimeType, response?.status, headers, contentLength);
      return;
    }

    const size = contentLength;
    if (!this.shouldCaptureImage(tabId, mimeType, size, url)) return;

    this.candidates.set(this.candidateKey(tabId, requestId), {
      requestId,
      tabId,
      url,
      mimeType,
      size,
      capturedAt: new Date().toISOString(),
      pageUrl: getCaptureSessionStore().getActiveSession()?.pageUrl ?? '',
    });
  }

  /**
   * Evaluate a video response and forward whole-resource candidates to the
   * download pipeline. The page's own response body is never read.
   */
  private handleVideoResponse(
    tabId: number,
    url: string,
    mimeType: string,
    status: number | undefined,
    headers: Record<string, string>,
    contentLength: number
  ): void {
    const urls = this.getVideoUrls(tabId);
    const evaluation = evaluateVideoResponse({
      url,
      mimeType,
      status,
      headers,
      contentLength,
      config: this.config,
      seenUrls: urls,
    });

    if (!evaluation.eligible) {
      if (evaluation.reason) {
        this.recordVideoSkipped(tabId, url, evaluation.reason);
      }
      return;
    }

    urls.add(url);
    this.dependencies.onVideoCandidate?.({
      tabId,
      url,
      mimeType,
      size: evaluation.totalSize,
      maxBytes: this.config.maxVideoSize,
      capturedAt: new Date().toISOString(),
      pageUrl: getCaptureSessionStore().getActiveSession()?.pageUrl,
    });
  }

  private async handleLoadingFinished(tabId: number, params?: CdpEventParams): Promise<void> {
    const requestId = params?.requestId;
    if (!requestId) return;

    const key = this.candidateKey(tabId, requestId);
    const candidate = this.candidates.get(key);
    if (!candidate) return;
    this.candidates.delete(key);

    try {
      const bodyResult = (await chrome.debugger.sendCommand({ tabId }, 'Network.getResponseBody', {
        requestId,
      })) as { body?: string; base64Encoded?: boolean };

      if (!bodyResult.body) {
        throw new Error('CDP returned an empty response body');
      }

      const buffer = decodeBody(bodyResult.body, Boolean(bodyResult.base64Encoded));
      if (buffer.length === 0) {
        throw new Error('Decoded response body is empty');
      }

      const fileManager = this.dependencies.getFileManager();
      const result = await fileManager.handleCaptureMedia({
        buffer,
        mimeType: candidate.mimeType,
        url: candidate.url,
        capturedAt: candidate.capturedAt,
      });

      const store = getCaptureSessionStore();
      if (store.getActiveSession()?.tabId === tabId) {
        store.applyEvent({
          kind: result.duplicate ? 'duplicate' : 'saved',
          hash: result.hash,
          mimeType: candidate.mimeType,
          size: buffer.length,
          sourceUrl: candidate.url,
          timestamp: candidate.capturedAt,
          pageUrl: candidate.pageUrl || undefined,
          reason: result.duplicate ? 'Content already exists' : undefined,
        });
      }

      // The app auto-enqueues AI tasks when it stores the file.
      const state = this.ensureState(tabId);
      state.captureCount += result.duplicate ? 0 : 1;
      state.lastCaptureTime = candidate.capturedAt;
      state.status = 'capturing';
      state.error = undefined;
      this.broadcastState(tabId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to capture response body';
      const state = this.ensureState(tabId);
      state.failedCount += 1;
      state.error = message;
      this.broadcastError(tabId, message, candidate.url);
      this.broadcastState(tabId);
    }
  }

  private handleLoadingFailed(tabId: number, params?: CdpEventParams): void {
    const requestId = params?.requestId;
    if (!requestId) return;
    this.candidates.delete(this.candidateKey(tabId, requestId));
  }

  private shouldCaptureImage(tabId: number, mimeType: string, size: number, url: string): boolean {
    const state = this.ensureState(tabId);

    if (mimeType === SVG_MIME_TYPE) {
      state.skippedCount += 1;
      this.recordSkip(tabId, url, 'SVG images are skipped');
      return false;
    }

    if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
      return false;
    }

    if (size > 0 && size < MIN_IMAGE_SIZE) {
      state.skippedCount += 1;
      this.recordSkip(tabId, url, `Image smaller than ${MIN_IMAGE_SIZE} bytes`);
      return false;
    }

    if (size > MAX_IMAGE_SIZE) {
      state.skippedCount += 1;
      this.recordSkip(tabId, url, `Image larger than ${MAX_IMAGE_SIZE} bytes`);
      return false;
    }

    return true;
  }

  /**
   * Record an increment for a skipped video candidate and notify listeners.
   */
  recordVideoSkipped(tabId: number, url: string, reason: string): void {
    const state = this.ensureState(tabId);
    state.skippedCount += 1;

    // Adaptive-streaming pages can produce hundreds of partial responses.
    // Count them all, but broadcast only the first few reasons.
    const broadcasts = this.videoSkipEvents.get(tabId) ?? 0;
    const shouldBroadcast = broadcasts < MAX_VIDEO_SKIP_EVENTS_PER_PAGE;
    this.recordSkip(tabId, url, reason, shouldBroadcast, shouldBroadcast);
    if (!shouldBroadcast) return;

    this.videoSkipEvents.set(tabId, broadcasts + 1);
    this.broadcastState(tabId);
  }

  /**
   * Record a successfully stored video.
   */
  recordVideoCaptured(tabId: number, capturedAt: string): void {
    const state = this.ensureState(tabId);
    state.captureCount += 1;
    state.lastCaptureTime = capturedAt;
    state.status = 'capturing';
    state.error = undefined;
    this.broadcastState(tabId);
  }

  /**
   * Record a failed video download or upload.
   */
  recordVideoFailed(tabId: number, url: string, message: string): void {
    const state = this.ensureState(tabId);
    state.failedCount += 1;
    state.error = message;
    // The video pipeline records the session-scoped `video:result` event
    // separately; this path only maintains per-tab state and legacy feedback.
    this.dependencies
      .getFileManager()
      .broadcastEvent('capture:error', { tabId, error: message, url });
    this.broadcastState(tabId);
  }

  /**
   * Get the per-tab set of video URLs already seen in this page session.
   */
  private getVideoUrls(tabId: number): Set<string> {
    let urls = this.videoUrls.get(tabId);
    if (!urls) {
      urls = new Set();
      this.videoUrls.set(tabId, urls);
    }
    return urls;
  }

  private clearVideoUrlsForTab(tabId: number): void {
    this.videoUrls.delete(tabId);
    this.videoSkipEvents.delete(tabId);
  }

  private handleDebuggerDetach(source: chrome.debugger.Debuggee, reason: string): void {
    if (typeof source.tabId !== 'number') return;
    const state = this.ensureState(source.tabId);
    state.debuggerAttached = false;
    state.isEnabled = false;
    state.status = reason === 'target_closed' ? 'idle' : 'error';
    state.error = reason === 'target_closed' ? undefined : `Debugger detached: ${reason}`;
    this.clearCandidatesForTab(source.tabId);
    this.clearVideoUrlsForTab(source.tabId);
    getExistingVideoDownloadManager()?.cancelTab(source.tabId);

    const store = getCaptureSessionStore();
    if (store.getActiveSession()?.tabId === source.tabId) {
      store.end(
        reason === 'target_closed' ? 'stopped' : 'error',
        reason === 'target_closed' ? undefined : `Debugger detached: ${reason}`
      );
    }

    this.broadcastState(source.tabId);
  }

  private handleTabRemoved(tabId: number): void {
    this.clearCandidatesForTab(tabId);
    this.clearVideoUrlsForTab(tabId);
    getExistingVideoDownloadManager()?.cancelTab(tabId);

    const store = getCaptureSessionStore();
    if (store.getActiveSession()?.tabId === tabId) {
      store.end('stopped');
    }

    this.states.delete(tabId);
  }

  private handleTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo): void {
    if (changeInfo.url || changeInfo.title || changeInfo.status === 'loading') {
      void this.refreshSessionIdentity(tabId);
    }

    if (changeInfo.status !== 'loading') return;
    const state = this.states.get(tabId);
    if (!state) return;

    // Per-tab page counters reset on navigation; session counters are
    // intentionally preserved by the CaptureSessionStore.
    state.captureCount = 0;
    state.skippedCount = 0;
    state.failedCount = 0;
    state.lastCaptureTime = undefined;
    state.error = undefined;
    this.clearCandidatesForTab(tabId);
    this.clearVideoUrlsForTab(tabId);
    getExistingVideoDownloadManager()?.cancelTab(tabId);
    if (state.isEnabled && state.debuggerAttached) {
      void this.enableNetwork(tabId).catch((error) => {
        const message =
          error instanceof Error ? error.message : 'Failed to re-enable Network after navigation';
        state.status = 'error';
        state.error = message;
        this.broadcastError(tabId, message);
        this.broadcastState(tabId);
      });
    }
    this.broadcastState(tabId);
  }

  private async refreshSessionIdentity(tabId: number): Promise<void> {
    const store = getCaptureSessionStore();
    if (store.getActiveSession()?.tabId !== tabId) return;

    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url) return;
      store.updateIdentity({
        tabTitle: tab.title ?? '',
        pageUrl: tab.url,
        origin: getOrigin(tab.url),
        windowId: tab.windowId,
      });
    } catch {
      // The tab may have closed between the event and the lookup.
    }
  }

  private async enableNetwork(tabId: number): Promise<void> {
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable', {
      maxTotalBufferSize: MAX_IMAGE_SIZE * 2,
      maxResourceBufferSize: MAX_IMAGE_SIZE,
    });
  }

  private clearCandidatesForTab(tabId: number): void {
    for (const [key, candidate] of this.candidates) {
      if (candidate.tabId === tabId) {
        this.candidates.delete(key);
      }
    }
  }

  private candidateKey(tabId: number, requestId: string): string {
    return `${tabId}:${requestId}`;
  }

  private broadcastState(tabId: number): void {
    this.dependencies
      .getFileManager()
      .broadcastEvent('capture:state', { ...this.ensureState(tabId) });
  }

  private broadcastError(tabId: number, error: string, url?: string): void {
    const store = getCaptureSessionStore();
    if (store.getActiveSession()?.tabId === tabId) {
      store.applyEvent({ kind: 'failed', error, sourceUrl: url });
    }
    this.dependencies.getFileManager().broadcastEvent('capture:error', { tabId, error, url });
  }

  private recordSkip(tabId: number, url: string, reason: string, notify = true, log = true): void {
    const store = getCaptureSessionStore();
    if (store.getActiveSession()?.tabId === tabId) {
      store.applyEvent({ kind: 'skipped', sourceUrl: url, reason }, notify, log);
    }

    if (notify) {
      this.dependencies.getFileManager().broadcastEvent('capture:skipped', { tabId, url, reason });
    }
  }
}

let captureController: DebuggerCaptureController | null = null;

export function initDebuggerCaptureController(
  dependencies: CaptureDependencies,
  config?: Partial<CaptureConfig>
): DebuggerCaptureController {
  captureController = new DebuggerCaptureController(dependencies, config);
  captureController.initialize();
  return captureController;
}

export function getDebuggerCaptureController(): DebuggerCaptureController {
  if (!captureController) {
    throw new Error('Debugger capture controller has not been initialized');
  }
  return captureController;
}

export function getExistingDebuggerCaptureController(): DebuggerCaptureController | null {
  return captureController;
}
