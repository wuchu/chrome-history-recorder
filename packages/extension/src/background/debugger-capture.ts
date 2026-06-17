import type { FileManager } from './file-manager';
import type { ClassifyScheduler } from './classify/scheduler';

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
}

interface CdpResponse {
  url?: string;
  headers?: Record<string, unknown>;
  mimeType?: string;
}

interface CdpEventParams {
  requestId?: string;
  response?: CdpResponse;
}

interface CaptureDependencies {
  getFileManager: () => FileManager;
  getScheduler: () => ClassifyScheduler;
}

const DEBUGGER_PROTOCOL_VERSION = '1.3';
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const MIN_IMAGE_SIZE = 10 * 1024;
const SVG_MIME_TYPE = 'image/svg+xml';
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
  return null;
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
  private readonly dependencies: CaptureDependencies;
  private readonly boundDebuggerEvent = this.handleDebuggerEvent.bind(this);
  private readonly boundDebuggerDetach = this.handleDebuggerDetach.bind(this);
  private readonly boundTabRemoved = this.handleTabRemoved.bind(this);
  private readonly boundTabUpdated = this.handleTabUpdated.bind(this);

  constructor(dependencies: CaptureDependencies) {
    this.dependencies = dependencies;
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

  async start(tabId: number): Promise<CaptureState> {
    const state = this.ensureState(tabId);
    state.isEnabled = true;
    state.status = 'capturing';
    state.error = undefined;

    try {
      if (!state.debuggerAttached) {
        await chrome.debugger.attach({ tabId }, DEBUGGER_PROTOCOL_VERSION);
        state.debuggerAttached = true;
      }

      await this.enableNetwork(tabId);

      this.broadcastState(tabId);
      return { ...state };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start capture';
      state.status = 'error';
      state.error = message;
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

    if (state.debuggerAttached) {
      try {
        await chrome.debugger.detach({ tabId });
      } catch (error) {
        console.warn('[DebuggerCapture] detach failed:', error);
      }
    }

    state.debuggerAttached = false;
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
    const headerMimeType = getHeader(headers, 'content-type');
    const rawMimeType = headerMimeType ?? response?.mimeType ?? inferMimeType(url);
    if (!rawMimeType) return;

    const mimeType = stripMimeParameters(rawMimeType);
    const size = Number.parseInt(getHeader(headers, 'content-length') ?? '0', 10) || 0;

    if (!this.shouldCapture(tabId, mimeType, size, url)) return;

    this.candidates.set(this.candidateKey(tabId, requestId), {
      requestId,
      tabId,
      url,
      mimeType,
      size,
      capturedAt: new Date().toISOString(),
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
      const scheduler = this.dependencies.getScheduler();
      const result = await fileManager.handleCaptureMedia({
        buffer,
        mimeType: candidate.mimeType,
        url: candidate.url,
        capturedAt: candidate.capturedAt,
      });

      if (!result.duplicate) {
        await scheduler.enqueue(result.hash);
      }

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

  private shouldCapture(tabId: number, mimeType: string, size: number, url: string): boolean {
    const state = this.ensureState(tabId);

    if (mimeType === SVG_MIME_TYPE) {
      state.skippedCount += 1;
      this.broadcastSkipped(tabId, url, 'SVG images are skipped');
      return false;
    }

    if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
      return false;
    }

    if (size > 0 && size < MIN_IMAGE_SIZE) {
      state.skippedCount += 1;
      this.broadcastSkipped(tabId, url, `Image smaller than ${MIN_IMAGE_SIZE} bytes`);
      return false;
    }

    if (size > MAX_IMAGE_SIZE) {
      state.skippedCount += 1;
      this.broadcastSkipped(tabId, url, `Image larger than ${MAX_IMAGE_SIZE} bytes`);
      return false;
    }

    return true;
  }

  private handleDebuggerDetach(source: chrome.debugger.Debuggee, reason: string): void {
    if (typeof source.tabId !== 'number') return;
    const state = this.ensureState(source.tabId);
    state.debuggerAttached = false;
    state.isEnabled = false;
    state.status = reason === 'target_closed' ? 'idle' : 'error';
    state.error = reason === 'target_closed' ? undefined : `Debugger detached: ${reason}`;
    this.clearCandidatesForTab(source.tabId);
    this.broadcastState(source.tabId);
  }

  private handleTabRemoved(tabId: number): void {
    this.clearCandidatesForTab(tabId);
    this.states.delete(tabId);
  }

  private handleTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo): void {
    if (changeInfo.status !== 'loading') return;
    const state = this.states.get(tabId);
    if (!state) return;

    state.captureCount = 0;
    state.skippedCount = 0;
    state.failedCount = 0;
    state.lastCaptureTime = undefined;
    state.error = undefined;
    this.clearCandidatesForTab(tabId);
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
    this.dependencies.getFileManager().broadcastEvent('capture:error', { tabId, error, url });
  }

  private broadcastSkipped(tabId: number, url: string, reason: string): void {
    this.dependencies.getFileManager().broadcastEvent('capture:skipped', { tabId, url, reason });
  }
}

let captureController: DebuggerCaptureController | null = null;

export function initDebuggerCaptureController(
  dependencies: CaptureDependencies
): DebuggerCaptureController {
  captureController = new DebuggerCaptureController(dependencies);
  captureController.initialize();
  return captureController;
}

export function getDebuggerCaptureController(): DebuggerCaptureController {
  if (!captureController) {
    throw new Error('Debugger capture controller has not been initialized');
  }
  return captureController;
}
