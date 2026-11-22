/**
 * Extension Background - Buffered video assembly controller
 *
 * Tracks byte ranges observed in the debugger session for a media resource.
 * The local VFS service owns the temporary file; this controller only reads
 * response bodies, forwards bytes, and finalizes once coverage is complete.
 * It never fills gaps, retries, or re-downloads the resource.
 */

import {
  coversTotal,
  evaluateSourceEvidence,
  extractMediaIdentity,
  isMediaForPage,
  mergeRanges,
  missingBytes,
  missingRanges,
  rangeLength,
  type ByteRange,
  type SourceEvidenceResult,
  type VideoAssemblySkipReason,
} from '../shared/video-assembly';
import { AssemblyClient, AssemblyRequestError, type AssemblyUploadResult } from './assembly-client';
import type { VideoSourceProbeResult } from './video-source-probe';

const ASSEMBLY_INLINE_BODY_LIMIT = 32 * 1024 * 1024;
const PROGRESS_INTERVAL_MS = 500;
const UNVERIFIED_RETRY_LIMIT = 3;
const UNVERIFIED_WINDOW_MS = 10_000;
const UNVERIFIED_ATTEMPT_THROTTLE_MS = 1000;
const DIAGNOSTIC_DETAIL_LIMIT = 240;
const GAP_FILL_CHUNK_BYTES = 1024 * 1024;
const GAP_FILL_DEBOUNCE_MS = 1500;
const GAP_FILL_MAX_ATTEMPTS = 3;
export const VIDEO_ASSEMBLY_STORAGE_KEY = 'videoAssemblySnapshot';

export interface BufferedVideoResponseInput {
  tabId: number;
  requestId: string;
  url: string;
  mimeType: string;
  status?: number;
  contentRange?: string | null;
  total: number;
  range: ByteRange;
  pageUrl: string;
  capturedAt: string;
}

export interface AssemblyProgressInfo {
  tabId: number;
  url: string;
  totalBytes: number;
  receivedBytes: number;
  activeJobs: number;
  pageUrl: string;
  detail?: string;
}

export interface AssemblyCompleteInfo {
  tabId: number;
  url: string;
  hash: string;
  size: number;
  mimeType: string;
  duplicate: boolean;
  pageUrl: string;
  result: AssemblyUploadResult;
}

export interface AssemblySkipInfo {
  tabId: number;
  url: string;
  reason: VideoAssemblySkipReason;
  missingBytes?: number;
  detail?: string;
  pageUrl: string;
}

export interface AssemblyFailureInfo {
  tabId: number;
  url: string;
  error: string;
  pageUrl: string;
}

export interface VideoAssemblyDependencies {
  sendCommand: (tabId: number, method: string, params: Record<string, unknown>) => Promise<unknown>;
  probeSources: (tabId: number) => Promise<VideoSourceProbeResult>;
  fetchRange?: (tabId: number, url: string, start: number, end: number) => Promise<Uint8Array>;
  getFillGaps?: () => boolean;
  client?: AssemblyClient;
  now?: () => number;
  onAssembling?: (info: AssemblyProgressInfo) => void;
  onActiveJobsChanged?: (count: number) => void;
  onComplete?: (info: AssemblyCompleteInfo) => void;
  onSkip?: (info: AssemblySkipInfo) => void;
  onFailed?: (info: AssemblyFailureInfo) => void;
}

interface AssemblyJobState {
  key: string;
  tabId: number;
  url: string;
  mimeType: string;
  total: number;
  pageUrl: string;
  capturedAt: string;
  jobId: string;
  token: string;
  intervals: ByteRange[];
  finalizing: boolean;
  bodyFailure: boolean;
  evidence: string;
  filling: boolean;
  fillAttempts: number;
  headWarningEmitted: boolean;
  fillPromise?: Promise<void>;
}

interface StreamState {
  start: number;
  length: number;
  jobPromise: Promise<AssemblyJobState | null>;
  job: AssemblyJobState | null;
  ready: boolean;
  failed: boolean;
  received: number;
  pending: string[];
  command: Promise<void>;
  writeChain: Promise<void>;
  completion: Promise<void>;
  finish: () => void;
}

interface RequestState {
  key: string;
  tabId: number;
  requestId: string;
  range: ByteRange;
  jobPromise: Promise<AssemblyJobState | null>;
  streaming: boolean;
  stream?: StreamState;
}

interface ResourceObservation {
  total: number;
  /** Distinct `start-end` strings, not merged intervals. */
  ranges: Set<string>;
}

interface UnverifiedAttemptState {
  count: number;
  firstAt: number;
  lastAt: number;
  tabId: number;
  url: string;
  pageUrl: string;
  detail: string;
}

interface PersistedJob {
  key: string;
  tabId: number;
  url: string;
  mimeType: string;
  total: number;
  pageUrl: string;
  capturedAt: string;
  jobId: string;
  token: string;
  intervals: ByteRange[];
}

interface PersistedSnapshot {
  version: 1;
  jobs: PersistedJob[];
}

function requestKey(tabId: number, requestId: string): string {
  return `${tabId}|${requestId}`;
}

function resourceKey(tabId: number, url: string): string {
  return `${tabId}|${url}`;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeBody(body: string, base64Encoded: boolean): Uint8Array {
  if (!base64Encoded) return new TextEncoder().encode(body);
  return decodeBase64(body);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sessionStorageArea(): chrome.storage.StorageArea | null {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.session) return null;
    return chrome.storage.session;
  } catch {
    return null;
  }
}

export class VideoAssemblyController {
  private readonly sendCommand: VideoAssemblyDependencies['sendCommand'];
  private readonly probeSources: VideoAssemblyDependencies['probeSources'];
  private readonly fetchRange?: VideoAssemblyDependencies['fetchRange'];
  private readonly getFillGaps?: VideoAssemblyDependencies['getFillGaps'];
  private readonly client: AssemblyClient;
  private readonly now: () => number;
  private readonly onAssembling?: (info: AssemblyProgressInfo) => void;
  private readonly onActiveJobsChanged?: (count: number) => void;
  private readonly onComplete?: (info: AssemblyCompleteInfo) => void;
  private readonly onSkip?: (info: AssemblySkipInfo) => void;
  private readonly onFailed?: (info: AssemblyFailureInfo) => void;

  private readonly jobs = new Map<string, AssemblyJobState>();
  private readonly pendingJobs = new Map<string, Promise<AssemblyJobState | null>>();
  private readonly requests = new Map<string, RequestState>();
  private readonly permanentSkips = new Map<string, VideoAssemblySkipReason>();
  private readonly observations = new Map<string, ResourceObservation>();
  private readonly unverifiedAttempts = new Map<string, UnverifiedAttemptState>();
  private readonly unverifiedTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly gapFillTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly inlineChains = new Map<number, Promise<void>>();
  private readonly streamChains = new Map<number, Promise<void>>();
  private readonly tabEpochs = new Map<number, number>();
  private readonly lastProgressAt = new Map<string, number>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(dependencies: VideoAssemblyDependencies) {
    this.sendCommand = dependencies.sendCommand;
    this.probeSources = dependencies.probeSources;
    this.fetchRange = dependencies.fetchRange;
    this.getFillGaps = dependencies.getFillGaps;
    this.client = dependencies.client ?? new AssemblyClient();
    this.now = dependencies.now ?? Date.now;
    this.onAssembling = dependencies.onAssembling;
    this.onActiveJobsChanged = dependencies.onActiveJobsChanged;
    this.onComplete = dependencies.onComplete;
    this.onSkip = dependencies.onSkip;
    this.onFailed = dependencies.onFailed;
  }

  /**
   * Register an eligible buffered video response. The response body itself is
   * read when the request finishes (or streamed for very large ranges).
   */
  async registerResponse(input: BufferedVideoResponseInput): Promise<void> {
    const reqKey = requestKey(input.tabId, input.requestId);
    if (this.requests.has(reqKey)) return;

    const key = resourceKey(input.tabId, input.url);
    if (this.permanentSkips.has(key)) return;

    // When the page exposes a stable media id (modal_id, aweme_id,
    // /video/<id>), only the focused media may occupy assembly slots. This
    // keeps search/feed preloads from exhausting capacity before the modal.
    const pageIdentity = extractMediaIdentity(input.url, input.pageUrl);
    if (pageIdentity.awemeId) {
      await this.pruneNonMatchingJobs(input.tabId, input.pageUrl);
      if (isMediaForPage(input.url, input.pageUrl) === false) return;
    }

    const observation = this.recordObservation(key, input);
    let jobPromise: Promise<AssemblyJobState | null>;
    const existing = this.jobs.get(key);

    if (existing) {
      if (existing.total !== input.total) {
        this.requests.set(reqKey, {
          key,
          tabId: input.tabId,
          requestId: input.requestId,
          range: input.range,
          jobPromise: Promise.resolve(null),
          streaming: false,
        });
        this.markPermanentSkip(key, 'total-mismatch', input, {
          detail: `total=${existing.total}->${input.total}`,
        });
        await this.discardJob(existing);
        return;
      }
      jobPromise = Promise.resolve(existing);
    } else {
      const pending = this.pendingJobs.get(key);
      if (pending) {
        jobPromise = pending;
      } else {
        jobPromise = this.openJob(input, observation);
        this.pendingJobs.set(key, jobPromise);
        void jobPromise.finally(() => this.pendingJobs.delete(key));
      }
    }

    const streaming =
      rangeLength(input.range) > ASSEMBLY_INLINE_BODY_LIMIT && !this.streamChains.has(input.tabId);
    const request: RequestState = {
      key,
      tabId: input.tabId,
      requestId: input.requestId,
      range: input.range,
      jobPromise,
      streaming,
    };

    if (streaming) {
      request.stream = this.createStream(request);
      this.streamChains.set(input.tabId, request.stream.completion);
    }

    this.requests.set(reqKey, request);
    if (request.stream) this.startStream(request.stream, input);
  }

  /**
   * The response finished successfully. Read its body (or finish the stream).
   */
  handleLoadingFinished(tabId: number, requestId: string): void {
    const reqKey = requestKey(tabId, requestId);
    const request = this.requests.get(reqKey);
    if (!request) return;

    if (request.stream) {
      const stream = request.stream;
      void (async () => {
        await stream.command;
        await stream.writeChain;
        if (stream.failed || stream.received !== stream.length) {
          if (stream.job) stream.job.bodyFailure = true;
        }
        this.finishStream(tabId, stream);
        this.requests.delete(reqKey);
      })();
      return;
    }

    this.requests.delete(reqKey);
    this.enqueueInline(tabId, async () => {
      const job = await request.jobPromise;
      if (!job || !this.jobs.has(job.key)) return;

      try {
        const result = (await this.sendCommand(tabId, 'Network.getResponseBody', {
          requestId,
        })) as { body?: string; base64Encoded?: boolean };

        if (!result?.body) {
          throw new Error('CDP returned an empty response body');
        }

        const bytes = decodeBody(result.body, Boolean(result.base64Encoded));
        if (bytes.length !== rangeLength(request.range)) {
          job.bodyFailure = true;
          return;
        }

        await this.writeRange(job, request.range.start, bytes);
      } catch {
        job.bodyFailure = true;
      }
    });
  }

  /**
   * `Network.dataReceived` may carry streamed bytes when streaming is enabled.
   */
  handleDataReceived(
    tabId: number,
    params: { requestId?: string; data?: string; dataLength?: number }
  ): void {
    const { requestId, data } = params;
    if (!requestId || typeof data !== 'string' || data.length === 0) return;

    const request = this.requests.get(requestKey(tabId, requestId));
    const stream = request?.stream;
    if (!stream) return;

    if (!stream.ready) {
      stream.pending.push(data);
      return;
    }
    this.appendStreamChunk(stream, data);
  }

  handleLoadingFailed(tabId: number, requestId: string): void {
    const reqKey = requestKey(tabId, requestId);
    const request = this.requests.get(reqKey);
    if (!request) return;
    this.requests.delete(reqKey);
    if (request.stream) {
      request.stream.failed = true;
      this.finishStream(tabId, request.stream);
    }
  }

  /**
   * Discard every job and request for a tab. Complete jobs are finalized
   * first; incomplete ones are reported and deleted.
   */
  async cancelTab(tabId: number): Promise<void> {
    this.tabEpochs.set(tabId, (this.tabEpochs.get(tabId) ?? 0) + 1);

    for (const [reqKey, request] of [...this.requests]) {
      if (request.tabId !== tabId) continue;
      if (request.stream) {
        request.stream.failed = true;
        this.finishStream(tabId, request.stream);
      }
      this.requests.delete(reqKey);
    }
    this.inlineChains.delete(tabId);
    this.streamChains.delete(tabId);

    // Source verification that never reached an assembly job is reported as a
    // terminal skip when the tab's capture context goes away.
    for (const [key, attempts] of [...this.unverifiedAttempts]) {
      if (attempts.tabId !== tabId) continue;
      this.unverifiedAttempts.delete(key);
      this.clearUnverifiedTimer(key);
      this.observations.delete(key);
      this.onSkip?.({
        tabId,
        url: attempts.url,
        reason: 'unverified-source',
        detail: `attempts=${attempts.count} ${attempts.detail}`,
        pageUrl: attempts.pageUrl,
      });
    }

    for (const [key, job] of [...this.jobs]) {
      if (job.tabId !== tabId) continue;
      if (job.finalizing) continue;
      if (coversTotal(job.intervals, job.total)) {
        await this.maybeFinalize(job);
        continue;
      }
      // Give an in-flight head/gap fill a short chance to finish before the
      // tab/session context is torn down.
      if (job.fillPromise) {
        await Promise.race([
          job.fillPromise,
          new Promise<void>((resolve) => setTimeout(resolve, 3000)),
        ]);
        if (!this.jobs.has(key)) continue;
        if (coversTotal(job.intervals, job.total)) {
          await this.maybeFinalize(job);
          continue;
        }
      }
      const missing = missingBytes(job.intervals, job.total);
      this.jobs.delete(key);
      this.markPermanentSkip(key, job.bodyFailure ? 'body-unavailable' : 'incomplete', job, {
        missing,
        detail: `missing=${missing} ${job.evidence}`,
      });
      await this.client.abort({ jobId: job.jobId, token: job.token }).catch(() => undefined);
    }

    for (const key of [...this.permanentSkips.keys()]) {
      if (key.startsWith(`${tabId}|`)) this.permanentSkips.delete(key);
    }
    for (const key of [...this.observations.keys()]) {
      if (key.startsWith(`${tabId}|`)) this.observations.delete(key);
    }
    for (const key of [...this.unverifiedTimers.keys()]) {
      if (key.startsWith(`${tabId}|`)) this.clearUnverifiedTimer(key);
    }
    for (const key of [...this.gapFillTimers.keys()]) {
      if (key.startsWith(`${tabId}|`)) this.clearGapFillTimer(key);
    }
    for (const key of [...this.lastProgressAt.keys()]) {
      if (key.startsWith(`${tabId}|`)) this.lastProgressAt.delete(key);
    }

    this.onActiveJobsChanged?.(this.jobs.size);
    this.schedulePersist();
  }

  async cancelAll(): Promise<void> {
    const tabIds = new Set([...this.jobs.values()].map((job) => job.tabId));
    for (const request of this.requests.values()) tabIds.add(request.tabId);
    for (const tabId of tabIds) {
      await this.cancelTab(tabId);
    }
  }

  /**
   * Finalize complete jobs and abort incomplete ones after a restart.
   */
  async restoreFromSession(): Promise<void> {
    const area = sessionStorageArea();
    if (!area) return;

    let snapshot: PersistedSnapshot | null = null;
    try {
      const stored = await area.get(VIDEO_ASSEMBLY_STORAGE_KEY);
      snapshot = (stored?.[VIDEO_ASSEMBLY_STORAGE_KEY] as PersistedSnapshot) ?? null;
    } catch {
      return;
    }
    if (!snapshot?.jobs?.length) return;

    for (const persisted of snapshot.jobs) {
      const ref = { jobId: persisted.jobId, token: persisted.token };
      try {
        if (coversTotal(persisted.intervals, persisted.total)) {
          await this.client.complete(ref);
        } else {
          await this.client.abort(ref);
        }
      } catch {
        await this.client.abort(ref).catch(() => undefined);
      }
    }

    await this.clearPersistedSnapshot();
  }

  private createStream(request: RequestState): StreamState {
    let finishStream: () => void = () => undefined;
    const completion = new Promise<void>((resolve) => {
      finishStream = resolve;
    });

    return {
      start: request.range.start,
      length: rangeLength(request.range),
      jobPromise: request.jobPromise,
      job: null,
      ready: false,
      failed: false,
      received: 0,
      pending: [],
      command: Promise.resolve(),
      writeChain: Promise.resolve(),
      completion,
      finish: finishStream,
    };
  }

  private startStream(stream: StreamState, input: BufferedVideoResponseInput): void {
    stream.command = (async () => {
      const job = await stream.jobPromise;
      if (!job || !this.jobs.has(job.key)) {
        stream.failed = true;
        return;
      }
      stream.job = job;

      try {
        const result = (await this.sendCommand(input.tabId, 'Network.streamResourceContent', {
          requestId: input.requestId,
        })) as { bufferedData?: string } | undefined;

        stream.ready = true;
        if (typeof result?.bufferedData === 'string' && result.bufferedData.length > 0) {
          this.appendStreamChunk(stream, result.bufferedData);
        }
        const pending = stream.pending.splice(0);
        for (const chunk of pending) {
          this.appendStreamChunk(stream, chunk);
        }
      } catch {
        stream.failed = true;
        if (stream.job) stream.job.bodyFailure = true;
      }
    })();
  }

  private appendStreamChunk(stream: StreamState, base64: string): void {
    if (stream.failed || !stream.job) return;

    let bytes: Uint8Array;
    try {
      bytes = decodeBase64(base64);
    } catch {
      stream.failed = true;
      return;
    }
    if (bytes.length === 0) return;

    if (stream.received + bytes.length > stream.length) {
      stream.failed = true;
      return;
    }

    const job = stream.job;
    const offset = stream.start + stream.received;
    stream.received += bytes.length;
    stream.writeChain = stream.writeChain.then(() => this.writeRange(job, offset, bytes));
  }

  private async writeRange(
    job: AssemblyJobState,
    offset: number,
    bytes: Uint8Array,
    fromGapFill = false
  ): Promise<void> {
    if (!this.jobs.has(job.key)) return;

    try {
      await this.client.writeChunk({ jobId: job.jobId, token: job.token }, offset, bytes);
    } catch {
      this.onSkip?.({
        tabId: job.tabId,
        url: job.url,
        reason: 'body-unavailable',
        detail: 'chunk-write-failed',
        pageUrl: job.pageUrl,
      });
      await this.discardJob(job);
      return;
    }

    job.intervals = mergeRanges([
      ...job.intervals,
      { start: offset, end: offset + bytes.length - 1 },
    ]);
    this.emitProgress(job);
    this.schedulePersist();
    if (!fromGapFill) this.scheduleGapFill(job);
    await this.maybeFinalize(job);
  }

  private async maybeFinalize(job: AssemblyJobState): Promise<void> {
    if (job.finalizing || !this.jobs.has(job.key)) return;
    if (!coversTotal(job.intervals, job.total)) return;

    job.finalizing = true;
    try {
      const result = await this.client.complete({ jobId: job.jobId, token: job.token });
      this.jobs.delete(job.key);
      this.onComplete?.({
        tabId: job.tabId,
        url: job.url,
        hash: result.hash,
        size: result.size,
        mimeType: result.mimeType ?? job.mimeType,
        duplicate: result.duplicate,
        pageUrl: job.pageUrl,
        result,
      });
    } catch (error) {
      this.jobs.delete(job.key);
      if (error instanceof AssemblyRequestError && error.status === 409) {
        this.onSkip?.({
          tabId: job.tabId,
          url: job.url,
          reason: 'incomplete',
          missingBytes: error.missingBytes ?? missingBytes(job.intervals, job.total),
          detail: `finalize=incomplete ${job.evidence}`,
          pageUrl: job.pageUrl,
        });
      } else {
        this.onFailed?.({
          tabId: job.tabId,
          url: job.url,
          error: errorMessage(error),
          pageUrl: job.pageUrl,
        });
      }
      await this.client.abort({ jobId: job.jobId, token: job.token }).catch(() => undefined);
    } finally {
      this.lastProgressAt.delete(job.key);
      this.clearGapFillTimer(job.key);
      this.onActiveJobsChanged?.(this.jobs.size);
      this.schedulePersist();
    }
  }

  private recordObservation(key: string, input: BufferedVideoResponseInput): ResourceObservation {
    let observation = this.observations.get(key);
    if (!observation || observation.total !== input.total) {
      observation = { total: input.total, ranges: new Set() };
      this.observations.set(key, observation);
    }
    observation.ranges.add(`${input.range.start}-${input.range.end}`);
    return observation;
  }

  /**
   * Abort jobs whose media does not belong to the page's focused video. This
   * frees assembly slots for the modal/active video on feed-heavy pages.
   */
  private async pruneNonMatchingJobs(tabId: number, pageUrl: string): Promise<void> {
    let changed = false;

    for (const [key, job] of [...this.jobs]) {
      if (job.tabId !== tabId || job.finalizing) continue;
      if (isMediaForPage(job.url, pageUrl) !== false) continue;

      this.jobs.delete(key);
      this.lastProgressAt.delete(key);
      this.observations.delete(key);
      this.clearUnverified(key);
      this.clearGapFillTimer(key);
      this.permanentSkips.delete(key);
      changed = true;
      await this.client.abort({ jobId: job.jobId, token: job.token }).catch(() => undefined);
    }

    if (changed) {
      this.onActiveJobsChanged?.(this.jobs.size);
      this.schedulePersist();
    }
  }

  private async openJob(
    input: BufferedVideoResponseInput,
    observation: ResourceObservation
  ): Promise<AssemblyJobState | null> {
    const key = resourceKey(input.tabId, input.url);
    const epoch = this.tabEpochs.get(input.tabId) ?? 0;

    try {
      // Strong network shape and page identity can be evaluated without any
      // page scripting. Only fall back to the probe when needed.
      let evidence = evaluateSourceEvidence({
        status: input.status,
        contentRange: input.contentRange,
        distinctRangeCount: observation.ranges.size,
        total: input.total,
        mediaUrl: input.url,
        pageUrl: input.pageUrl,
        probeStatus: 'unverified',
        sources: [],
      });

      if (evidence.decision !== 'accept') {
        const probe = await this.probeSources(input.tabId);
        evidence = evaluateSourceEvidence({
          status: input.status,
          contentRange: input.contentRange,
          distinctRangeCount: observation.ranges.size,
          total: input.total,
          mediaUrl: input.url,
          pageUrl: input.pageUrl,
          probeStatus: probe.status,
          sources: probe.sources,
        });
      }

      if (evidence.decision === 'mse') {
        this.markPermanentSkip(key, 'in-memory', input, { detail: evidence.detail });
        return null;
      }

      if (evidence.decision === 'retry') {
        this.handleUnverified(key, input, evidence);
        return null;
      }

      return await this.createAssemblyJob(input, key, epoch, evidence);
    } catch (error) {
      if (error instanceof AssemblyRequestError && error.status === 429) {
        // Capacity is transient. Do not blacklist the media; later ranges can
        // retry after other jobs finalize or are pruned.
        console.warn('[VideoAssembly] Assembly capacity full; deferring media');
        return null;
      }
      this.onFailed?.({
        tabId: input.tabId,
        url: input.url,
        error: errorMessage(error),
        pageUrl: input.pageUrl,
      });
      return null;
    }
  }

  private async createAssemblyJob(
    input: BufferedVideoResponseInput,
    key: string,
    epoch: number,
    evidence: SourceEvidenceResult
  ): Promise<AssemblyJobState | null> {
    if (isMediaForPage(input.url, input.pageUrl) === false) return null;

    const created = await this.client.createJob({
      totalSize: input.total,
      mimeType: input.mimeType,
      sourceUrl: input.url,
      pageUrl: input.pageUrl,
      capturedAt: input.capturedAt,
    });

    // A navigation or session stop may have happened while the job was
    // being created. Do not leave an orphaned server-side job behind.
    if ((this.tabEpochs.get(input.tabId) ?? 0) !== epoch) {
      await this.client
        .abort({ jobId: created.jobId, token: created.token })
        .catch(() => undefined);
      return null;
    }

    if (isMediaForPage(input.url, input.pageUrl) === false) {
      await this.client
        .abort({ jobId: created.jobId, token: created.token })
        .catch(() => undefined);
      return null;
    }

    this.clearUnverified(key);
    this.observations.delete(key);

    const job: AssemblyJobState = {
      key,
      tabId: input.tabId,
      url: input.url,
      mimeType: input.mimeType,
      total: input.total,
      pageUrl: input.pageUrl,
      capturedAt: input.capturedAt,
      jobId: created.jobId,
      token: created.token,
      intervals: [],
      finalizing: false,
      bodyFailure: false,
      evidence: `${evidence.strategy ?? 'evidence'} ${evidence.detail}`,
      filling: false,
      fillAttempts: 0,
      headWarningEmitted: false,
    };
    this.jobs.set(key, job);
    this.onActiveJobsChanged?.(this.jobs.size);

    const headGap = input.range.start > 0 ? { start: 0, end: input.range.start - 1 } : null;
    const headWarning = headGap
      ? `hint=${this.fillGapsEnabled() ? 'filling-head' : 'reload-page'} missing-head=${input.range.start}`
      : undefined;
    if (headWarning) job.headWarningEmitted = true;
    this.emitProgress(job, true, headWarning);
    if (headGap && this.fillGapsEnabled()) {
      // Fill the known head gap immediately. Waiting for the debounce is too
      // late when the user closes the modal/stop capture within a second.
      void this.fillGaps(job, [headGap]);
    }
    this.schedulePersist();
    return job;
  }

  private handleUnverified(
    key: string,
    input: BufferedVideoResponseInput,
    evidence: SourceEvidenceResult
  ): void {
    const now = this.now();
    let attempts = this.unverifiedAttempts.get(key);
    if (!attempts) {
      attempts = {
        count: 0,
        firstAt: now,
        lastAt: 0,
        tabId: input.tabId,
        url: input.url,
        pageUrl: input.pageUrl,
        detail: evidence.detail,
      };
      this.unverifiedAttempts.set(key, attempts);
    } else {
      attempts.detail = evidence.detail;
    }

    if (now - attempts.lastAt >= UNVERIFIED_ATTEMPT_THROTTLE_MS) {
      attempts.count += 1;
      attempts.lastAt = now;
    }

    if (
      attempts.count >= UNVERIFIED_RETRY_LIMIT ||
      now - attempts.firstAt >= UNVERIFIED_WINDOW_MS
    ) {
      this.finalizeUnverified(key, attempts, `attempts=${attempts.count} `);
      return;
    }

    if (!this.unverifiedTimers.has(key)) {
      const timer = setTimeout(() => {
        this.unverifiedTimers.delete(key);
        const pending = this.unverifiedAttempts.get(key);
        if (!pending || this.jobs.has(key) || this.permanentSkips.has(key)) return;
        this.finalizeUnverified(
          key,
          pending,
          `attempts=${pending.count} timeout=${UNVERIFIED_WINDOW_MS}ms `
        );
      }, UNVERIFIED_WINDOW_MS);
      this.unverifiedTimers.set(key, timer);
    }
  }

  private finalizeUnverified(key: string, attempts: UnverifiedAttemptState, prefix: string): void {
    this.unverifiedAttempts.delete(key);
    this.clearUnverifiedTimer(key);
    this.markPermanentSkip(
      key,
      'unverified-source',
      { tabId: attempts.tabId, url: attempts.url, pageUrl: attempts.pageUrl },
      { detail: `${prefix}${attempts.detail}` }
    );
  }

  private clearUnverified(key: string): void {
    this.unverifiedAttempts.delete(key);
    this.clearUnverifiedTimer(key);
  }

  private clearUnverifiedTimer(key: string): void {
    const timer = this.unverifiedTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.unverifiedTimers.delete(key);
    }
  }

  private async discardJob(job: AssemblyJobState): Promise<void> {
    if (!this.jobs.delete(job.key)) return;
    this.lastProgressAt.delete(job.key);
    this.clearGapFillTimer(job.key);
    await this.client.abort({ jobId: job.jobId, token: job.token }).catch(() => undefined);
    this.onActiveJobsChanged?.(this.jobs.size);
    this.schedulePersist();
  }

  private markPermanentSkip(
    key: string,
    reason: VideoAssemblySkipReason,
    info: { tabId: number; url: string; pageUrl: string },
    options: { detail?: string; missing?: number } = {}
  ): void {
    if (this.permanentSkips.has(key)) return;
    this.permanentSkips.set(key, reason);
    this.clearUnverified(key);
    this.observations.delete(key);
    this.onSkip?.({
      tabId: info.tabId,
      url: info.url,
      reason,
      missingBytes: options.missing,
      detail: options.detail ? options.detail.slice(0, DIAGNOSTIC_DETAIL_LIMIT) : undefined,
      pageUrl: info.pageUrl,
    });
  }

  private fillGapsEnabled(): boolean {
    return this.getFillGaps?.() === true && typeof this.fetchRange === 'function';
  }

  private scheduleGapFill(job: AssemblyJobState): void {
    if (!this.fillGapsEnabled() || job.filling) return;
    if (job.fillAttempts >= GAP_FILL_MAX_ATTEMPTS) return;
    if (coversTotal(job.intervals, job.total)) return;

    this.clearGapFillTimer(job.key);
    const timer = setTimeout(() => {
      this.gapFillTimers.delete(job.key);
      void this.fillGaps(job);
    }, GAP_FILL_DEBOUNCE_MS);
    this.gapFillTimers.set(job.key, timer);
  }

  private clearGapFillTimer(key: string): void {
    const timer = this.gapFillTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.gapFillTimers.delete(key);
    }
  }

  /**
   * Optional fallback: fill missing byte ranges from the same media URL using
   * the page's credentials. Only runs when the user enabled the setting.
   */
  private async fillGaps(job: AssemblyJobState, holesOverride?: ByteRange[]): Promise<void> {
    if (!this.fillGapsEnabled() || job.filling || !this.jobs.has(job.key)) return;
    const holes = holesOverride ?? missingRanges(job.intervals, job.total);
    if (holes.length === 0) {
      await this.maybeFinalize(job);
      return;
    }

    job.filling = true;
    job.fillAttempts += 1;
    let resolveFill!: () => void;
    job.fillPromise = new Promise<void>((resolve) => {
      resolveFill = resolve;
    });
    this.emitProgress(
      job,
      true,
      `fill-gaps=start missing=${missingBytes(job.intervals, job.total)}`
    );

    try {
      for (const hole of holes) {
        let cursor = hole.start;
        while (cursor <= hole.end) {
          if (!this.jobs.has(job.key)) return;
          const end = Math.min(hole.end, cursor + GAP_FILL_CHUNK_BYTES - 1);
          const bytes = await this.fetchRange!(job.tabId, job.url, cursor, end);
          if (bytes.length !== end - cursor + 1) {
            throw new Error('Gap-fill length mismatch');
          }
          await this.writeRange(job, cursor, bytes, true);
          cursor = end + 1;
        }
      }
      this.emitProgress(
        job,
        true,
        `fill-gaps=done missing=${missingBytes(job.intervals, job.total)}`
      );
    } catch (error) {
      this.emitProgress(job, true, `fill-gaps=failed ${errorMessage(error)}`);
    } finally {
      job.filling = false;
      job.fillPromise = undefined;
      resolveFill();
      if (this.jobs.has(job.key)) {
        if (coversTotal(job.intervals, job.total)) {
          await this.maybeFinalize(job);
        } else if (job.fillAttempts < GAP_FILL_MAX_ATTEMPTS) {
          this.scheduleGapFill(job);
        }
      }
    }
  }

  private emitProgress(job: AssemblyJobState, force = false, detail?: string): void {
    const now = this.now();
    const last = this.lastProgressAt.get(job.key) ?? 0;
    if (!force && now - last < PROGRESS_INTERVAL_MS) return;
    this.lastProgressAt.set(job.key, now);

    this.onAssembling?.({
      tabId: job.tabId,
      url: job.url,
      totalBytes: job.total,
      receivedBytes: job.total - missingBytes(job.intervals, job.total),
      activeJobs: this.jobs.size,
      pageUrl: job.pageUrl,
      detail,
    });
  }

  private finishStream(tabId: number, stream: StreamState): void {
    stream.finish();
    if (this.streamChains.get(tabId) === stream.completion) {
      this.streamChains.delete(tabId);
    }
  }

  private enqueueInline(tabId: number, task: () => Promise<void>): void {
    const previous = this.inlineChains.get(tabId) ?? Promise.resolve();
    const streamGate = this.streamChains.get(tabId) ?? Promise.resolve();
    const next = Promise.all([previous, streamGate])
      .then(task, task)
      .catch(() => undefined);
    this.inlineChains.set(tabId, next);
    void next.finally(() => {
      if (this.inlineChains.get(tabId) === next) this.inlineChains.delete(tabId);
    });
  }

  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persistSnapshot();
    }, 250);
  }

  private async persistSnapshot(): Promise<void> {
    const area = sessionStorageArea();
    if (!area) return;

    const snapshot: PersistedSnapshot = {
      version: 1,
      jobs: [...this.jobs.values()].map((job) => ({
        key: job.key,
        tabId: job.tabId,
        url: job.url,
        mimeType: job.mimeType,
        total: job.total,
        pageUrl: job.pageUrl,
        capturedAt: job.capturedAt,
        jobId: job.jobId,
        token: job.token,
        intervals: job.intervals,
      })),
    };

    try {
      await area.set({ [VIDEO_ASSEMBLY_STORAGE_KEY]: snapshot });
    } catch {
      // Session storage is best-effort.
    }
  }

  private async clearPersistedSnapshot(): Promise<void> {
    const area = sessionStorageArea();
    if (!area) return;
    try {
      await area.set({
        [VIDEO_ASSEMBLY_STORAGE_KEY]: { version: 1, jobs: [] } satisfies PersistedSnapshot,
      });
    } catch {
      // Best-effort.
    }
  }
}

let controller: VideoAssemblyController | null = null;

export function initVideoAssemblyController(
  dependencies: VideoAssemblyDependencies
): VideoAssemblyController {
  controller = new VideoAssemblyController(dependencies);
  void controller.restoreFromSession();
  return controller;
}

export function getExistingVideoAssemblyController(): VideoAssemblyController | null {
  return controller;
}
