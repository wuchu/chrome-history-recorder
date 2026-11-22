/**
 * Capture Session Store
 *
 * Owns the single active capture session: identity, counters, the bounded
 * recent-item feed, the bounded event log, the stopped-session summary, and
 * the `chrome.storage.session` snapshot used to survive panel closes and
 * service-worker restarts.
 */

import type {
  CaptureSession,
  CaptureSessionSnapshot,
  CaptureSessionStatus,
  SessionAiStatus,
  SessionCounters,
  SessionEvent,
  SessionEventInput,
  SessionMediaItem,
  SessionSummary,
  SessionTopReason,
} from '../shared/extension-runtime';

export const CAPTURE_SESSION_STORAGE_KEY = 'captureSessionSnapshot';
export const MAX_SESSION_EVENTS = 200;
export const MAX_RECENT_ITEMS = 20;
export const DEFAULT_PERSIST_THROTTLE_MS = 750;

interface SessionStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface CaptureSessionStoreOptions {
  storage?: SessionStorage;
  now?: () => Date;
  onChange?: (snapshot: CaptureSessionSnapshot) => void;
  persistThrottleMs?: number;
  persist?: boolean;
}

interface StartSessionInput {
  tabId: number;
  windowId?: number;
  tabTitle: string;
  pageUrl: string;
  origin: string;
}

function createEmptyCounters(): SessionCounters {
  return {
    saved: 0,
    duplicate: 0,
    skipped: 0,
    failed: 0,
    bytesSaved: 0,
    imagesSaved: 0,
    videosSaved: 0,
    aiPending: 0,
    aiProcessing: 0,
    aiCompleted: 0,
    aiFailed: 0,
    aiSkipped: 0,
    videosQueued: 0,
    videosDownloading: 0,
    videosAssembling: 0,
    videosComplete: 0,
    videosIncomplete: 0,
  };
}

/**
 * Fill fields introduced after a snapshot was written so an older session can
 * be restored without undefined counters or arrays.
 */
function normalizeRestoredSession(session: CaptureSession): CaptureSession {
  return {
    ...session,
    counters: { ...createEmptyCounters(), ...(session.counters ?? {}) },
    recentItems: session.recentItems ?? [],
    events: session.events ?? [],
    savedHashes: session.savedHashes ?? [],
    aiStatuses: session.aiStatuses ?? {},
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function defaultStorage(): SessionStorage {
  return {
    get: (key) => chrome.storage.session.get(key),
    set: (items) => chrome.storage.session.set(items),
  };
}

function createSessionId(now: Date): string {
  return `session-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Apply one capture event to the session counters.
 *
 * Returns false when the event should not be recorded, which happens for AI
 * events that reference a hash not saved in this session.
 */
function applyEventToSession(session: CaptureSession, event: SessionEvent): boolean {
  const counters = session.counters;
  const addSavedItem = (item: SessionMediaItem) => {
    session.recentItems = [item, ...session.recentItems].slice(0, MAX_RECENT_ITEMS);
  };

  switch (event.kind) {
    case 'saved': {
      if (!event.hash) return false;
      counters.saved += 1;
      counters.bytesSaved += event.size ?? 0;
      if (event.mimeType?.startsWith('video/')) counters.videosSaved += 1;
      else counters.imagesSaved += 1;
      if (!session.savedHashes.includes(event.hash)) {
        session.savedHashes.push(event.hash);
      }
      const aiStatus: SessionAiStatus = 'pending';
      session.aiStatuses[event.hash] = aiStatus;
      addSavedItem({
        hash: event.hash,
        mimeType: event.mimeType ?? 'application/octet-stream',
        size: event.size ?? 0,
        sourceUrl: event.sourceUrl,
        capturedAt: event.timestamp,
        aiStatus,
      });
      break;
    }
    case 'duplicate': {
      if (!event.hash) return false;
      counters.duplicate += 1;
      addSavedItem({
        hash: event.hash,
        mimeType: event.mimeType ?? 'application/octet-stream',
        size: event.size ?? 0,
        sourceUrl: event.sourceUrl,
        capturedAt: event.timestamp,
        duplicate: true,
      });
      break;
    }
    case 'skipped': {
      counters.skipped += 1;
      break;
    }
    case 'failed': {
      counters.failed += 1;
      break;
    }
    case 'video:candidate': {
      counters.videosQueued += 1;
      break;
    }
    case 'video:result': {
      if (counters.videosDownloading > 0) {
        counters.videosDownloading -= 1;
      } else if (counters.videosQueued > 0) {
        counters.videosQueued -= 1;
      }
      if (event.error) {
        counters.failed += 1;
        break;
      }
      if (event.hash) {
        if (event.duplicate) {
          counters.duplicate += 1;
          addSavedItem({
            hash: event.hash,
            mimeType: event.mimeType ?? 'video/mp4',
            size: event.size ?? 0,
            sourceUrl: event.sourceUrl,
            capturedAt: event.timestamp,
            duplicate: true,
          });
          break;
        }
        counters.saved += 1;
        counters.videosSaved += 1;
        counters.bytesSaved += event.size ?? 0;
        if (!session.savedHashes.includes(event.hash)) {
          session.savedHashes.push(event.hash);
        }
        const aiStatus: SessionAiStatus = 'pending';
        session.aiStatuses[event.hash] = aiStatus;
        addSavedItem({
          hash: event.hash,
          mimeType: event.mimeType ?? 'video/mp4',
          size: event.size ?? 0,
          sourceUrl: event.sourceUrl,
          capturedAt: event.timestamp,
          aiStatus,
        });
      }
      break;
    }
    case 'video:assembling': {
      break;
    }
    case 'video:complete': {
      if (!event.hash) return false;
      counters.videosComplete += 1;
      if (event.duplicate) {
        counters.duplicate += 1;
        addSavedItem({
          hash: event.hash,
          mimeType: event.mimeType ?? 'video/mp4',
          size: event.size ?? 0,
          sourceUrl: event.sourceUrl,
          capturedAt: event.timestamp,
          duplicate: true,
        });
        break;
      }
      counters.saved += 1;
      counters.videosSaved += 1;
      counters.bytesSaved += event.size ?? 0;
      if (!session.savedHashes.includes(event.hash)) {
        session.savedHashes.push(event.hash);
      }
      const bufferedAiStatus: SessionAiStatus = 'pending';
      session.aiStatuses[event.hash] = bufferedAiStatus;
      addSavedItem({
        hash: event.hash,
        mimeType: event.mimeType ?? 'video/mp4',
        size: event.size ?? 0,
        sourceUrl: event.sourceUrl,
        capturedAt: event.timestamp,
        aiStatus: bufferedAiStatus,
      });
      break;
    }
    case 'video:skipped': {
      counters.skipped += 1;
      if (
        event.reason === 'incomplete' ||
        event.reason === 'body-unavailable' ||
        event.reason === 'truncated' ||
        event.reason === 'aborted'
      ) {
        counters.videosIncomplete += 1;
      }
      break;
    }
    case 'ai': {
      if (!event.hash || !session.savedHashes.includes(event.hash)) return false;
      if (!event.aiStatus) return false;
      session.aiStatuses[event.hash] = event.aiStatus;
      const item = session.recentItems.find((candidate) => candidate.hash === event.hash);
      if (item) item.aiStatus = event.aiStatus;
      break;
    }
    default:
      return false;
  }

  recomputeAiCounters(session);
  return true;
}

function recomputeAiCounters(session: CaptureSession): void {
  const counts = { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 };
  for (const status of Object.values(session.aiStatuses)) {
    counts[status] += 1;
  }
  session.counters.aiPending = counts.pending;
  session.counters.aiProcessing = counts.processing;
  session.counters.aiCompleted = counts.completed;
  session.counters.aiFailed = counts.failed;
  session.counters.aiSkipped = counts.skipped;
}

function buildSummary(session: CaptureSession, endedAt: string): SessionSummary {
  const reasonCounts = new Map<string, number>();
  for (const event of session.events) {
    if (event.kind !== 'skipped' && event.kind !== 'failed' && event.kind !== 'video:skipped') {
      continue;
    }
    const reason = event.error || event.reason;
    if (!reason) continue;
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }

  const topReasons: SessionTopReason[] = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    sessionId: session.id,
    tabId: session.tabId,
    tabTitle: session.tabTitle,
    pageUrl: session.pageUrl,
    startedAt: session.startedAt,
    endedAt,
    durationMs: Math.max(0, new Date(endedAt).getTime() - new Date(session.startedAt).getTime()),
    counters: clone(session.counters),
    topReasons,
    error: session.error,
  };
}

export class CaptureSessionStore {
  private session: CaptureSession | null = null;
  private summary: SessionSummary | null = null;
  private readonly storage: SessionStorage;
  private readonly now: () => Date;
  private readonly onChange?: (snapshot: CaptureSessionSnapshot) => void;
  private readonly persistThrottleMs: number;
  private readonly persistEnabled: boolean;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private eventSequence = 0;
  private deferredAiStatuses = new Map<string, SessionAiStatus>();

  constructor(options: CaptureSessionStoreOptions = {}) {
    this.storage = options.storage ?? defaultStorage();
    this.now = options.now ?? (() => new Date());
    this.onChange = options.onChange;
    this.persistThrottleMs = options.persistThrottleMs ?? DEFAULT_PERSIST_THROTTLE_MS;
    this.persistEnabled = options.persist ?? true;
  }

  /**
   * Restore a snapshot from chrome.storage.session.
   */
  async restore(): Promise<void> {
    if (!this.persistEnabled) return;

    try {
      const stored = await this.storage.get(CAPTURE_SESSION_STORAGE_KEY);
      const snapshot = stored[CAPTURE_SESSION_STORAGE_KEY] as CaptureSessionSnapshot | undefined;
      if (!snapshot?.session) return;
      this.session = normalizeRestoredSession(snapshot.session);
      this.summary = snapshot.summary ?? null;
      this.notify();
    } catch (error) {
      console.warn('[CaptureSession] Failed to restore session snapshot:', error);
    }
  }

  /**
   * Return the active session, or null when no session is capturing.
   */
  getActiveSession(): CaptureSession | null {
    return this.session?.status === 'capturing' ? this.session : null;
  }

  getCurrentPageUrl(): string | undefined {
    return this.session?.pageUrl;
  }

  getSnapshot(): CaptureSessionSnapshot {
    return clone({ session: this.session, summary: this.summary });
  }

  hasSavedHash(hash: string): boolean {
    return Boolean(this.session?.savedHashes.includes(hash));
  }

  /**
   * Start a new session, replacing any previous session and summary.
   */
  start(input: StartSessionInput): CaptureSession {
    const now = this.now();
    const startedAt = now.toISOString();
    const session: CaptureSession = {
      id: createSessionId(now),
      tabId: input.tabId,
      windowId: input.windowId,
      tabTitle: input.tabTitle,
      pageUrl: input.pageUrl,
      origin: input.origin,
      startedAt,
      status: 'capturing',
      counters: createEmptyCounters(),
      recentItems: [],
      events: [],
      savedHashes: [],
      aiStatuses: {},
    };

    if (this.session) {
      this.summary = buildSummary(
        { ...this.session, status: 'stopped', endedAt: this.session.endedAt ?? startedAt },
        startedAt
      );
    } else {
      this.summary = null;
    }

    this.deferredAiStatuses.clear();
    this.session = session;
    this.notify();
    this.schedulePersist();
    return clone(session);
  }

  /**
   * End the current session and retain its summary.
   */
  end(status: Exclude<CaptureSessionStatus, 'capturing'>, error?: string): CaptureSessionSnapshot {
    if (!this.session) return this.getSnapshot();
    if (this.session.status !== 'capturing') return this.getSnapshot();

    const endedAt = this.now().toISOString();
    this.session.status = status;
    this.session.endedAt = endedAt;
    this.session.error = error;
    this.summary = buildSummary(this.session, endedAt);
    this.notify();
    this.flushPersist();
    return this.getSnapshot();
  }

  /**
   * Update the session tab identity after a title or URL change.
   */
  updateIdentity(update: {
    tabTitle?: string;
    pageUrl?: string;
    origin?: string;
    windowId?: number;
  }): void {
    if (!this.session) return;
    if (update.tabTitle !== undefined) this.session.tabTitle = update.tabTitle;
    if (update.pageUrl !== undefined) this.session.pageUrl = update.pageUrl;
    if (update.origin !== undefined) this.session.origin = update.origin;
    if (update.windowId !== undefined) this.session.windowId = update.windowId;
    this.notify();
    this.schedulePersist();
  }

  /**
   * Apply one event to the session. Events outside the active session are
   * ignored. `notify` can be false for high-volume events whose counters still
   * matter but whose individual log rows should not be broadcast live.
   */
  applyEvent(input: SessionEventInput, notify = true, log = true): SessionEvent | null {
    if (!this.session || this.session.status !== 'capturing') return null;

    const timestamp = input.timestamp ?? this.now().toISOString();
    const event: SessionEvent = {
      id: `${timestamp}-${this.eventSequence++}`,
      sessionId: this.session.id,
      tabId: this.session.tabId,
      pageUrl: input.pageUrl ?? this.session.pageUrl,
      kind: input.kind,
      timestamp,
      hash: input.hash,
      mimeType: input.mimeType,
      size: input.size,
      sourceUrl: input.sourceUrl,
      reason: input.reason,
      error: input.error,
      aiStatus: input.aiStatus,
      duplicate: input.duplicate,
      receivedBytes: input.receivedBytes,
      totalBytes: input.totalBytes,
      missingBytes: input.missingBytes,
      detail: input.detail,
    };

    const recorded = applyEventToSession(this.session, event);
    if (!recorded) return null;

    if (log) {
      this.session.events = [event, ...this.session.events].slice(0, MAX_SESSION_EVENTS);
    }

    const savedHash =
      event.kind === 'saved' ||
      (event.kind === 'video:result' && !event.error && !event.duplicate) ||
      (event.kind === 'video:complete' && !event.duplicate)
        ? event.hash
        : undefined;
    if (savedHash) {
      const deferred = this.deferredAiStatuses.get(savedHash);
      if (deferred) {
        this.deferredAiStatuses.delete(savedHash);
        this.recordAiStatus(savedHash, deferred);
      }
    }

    if (notify) this.notify();
    this.schedulePersist();
    return event;
  }

  recordVideoCandidate(input: {
    url: string;
    mimeType: string;
    size: number;
    pageUrl?: string;
  }): void {
    this.applyEvent({
      kind: 'video:candidate',
      sourceUrl: input.url,
      mimeType: input.mimeType,
      size: input.size,
      pageUrl: input.pageUrl,
    });
  }

  recordVideoDownloadStarted(): void {
    if (!this.session || this.session.status !== 'capturing') return;
    if (this.session.counters.videosQueued > 0) {
      this.session.counters.videosQueued -= 1;
    }
    this.session.counters.videosDownloading += 1;
    this.notify();
    this.schedulePersist();
  }

  recordVideoDownloadCancelled(): void {
    if (!this.session || this.session.status !== 'capturing') return;
    if (this.session.counters.videosDownloading > 0) {
      this.session.counters.videosDownloading -= 1;
    } else if (this.session.counters.videosQueued > 0) {
      this.session.counters.videosQueued -= 1;
    }
    this.notify();
    this.schedulePersist();
  }

  recordVideoResult(input: {
    hash?: string;
    mimeType?: string;
    size?: number;
    url?: string;
    error?: string;
    duplicate?: boolean;
    pageUrl?: string;
  }): void {
    this.applyEvent({
      kind: 'video:result',
      hash: input.hash,
      mimeType: input.mimeType,
      size: input.size,
      sourceUrl: input.url,
      error: input.error,
      duplicate: input.duplicate,
      pageUrl: input.pageUrl,
    });
  }

  recordVideoAssembling(input: {
    url: string;
    receivedBytes: number;
    totalBytes: number;
    detail?: string;
    pageUrl?: string;
  }): void {
    this.applyEvent({
      kind: 'video:assembling',
      sourceUrl: input.url,
      receivedBytes: input.receivedBytes,
      totalBytes: input.totalBytes,
      detail: input.detail,
      pageUrl: input.pageUrl,
    });
  }

  setVideoAssemblingCount(count: number): void {
    if (!this.session || this.session.status !== 'capturing') return;
    if (this.session.counters.videosAssembling === count) return;
    this.session.counters.videosAssembling = count;
    this.notify();
    this.schedulePersist();
  }

  recordVideoAssemblyComplete(input: {
    hash: string;
    size: number;
    mimeType?: string;
    url: string;
    duplicate?: boolean;
    pageUrl?: string;
  }): void {
    this.applyEvent({
      kind: 'video:complete',
      hash: input.hash,
      size: input.size,
      mimeType: input.mimeType,
      sourceUrl: input.url,
      duplicate: input.duplicate,
      pageUrl: input.pageUrl,
    });
  }

  recordVideoAssemblySkipped(input: {
    url: string;
    reason: string;
    missingBytes?: number;
    detail?: string;
    pageUrl?: string;
  }): void {
    this.applyEvent({
      kind: 'video:skipped',
      sourceUrl: input.url,
      reason: input.reason,
      missingBytes: input.missingBytes,
      detail: input.detail,
      pageUrl: input.pageUrl,
    });
  }

  recordAiStatus(
    hash: string,
    aiStatus: SessionAiStatus,
    detail?: { reason?: string; error?: string }
  ): void {
    if (!this.session || this.session.status !== 'capturing') return;
    if (!this.hasSavedHash(hash)) {
      // AI events can arrive before the save response is processed. Keep the
      // latest status and apply it when the saved event lands. The cache is
      // bounded because global AI events for files outside this session also
      // pass through here.
      if (this.deferredAiStatuses.size >= 100) {
        const oldest = this.deferredAiStatuses.keys().next().value;
        if (oldest) this.deferredAiStatuses.delete(oldest);
      }
      this.deferredAiStatuses.set(hash, aiStatus);
      return;
    }
    if (this.session?.aiStatuses[hash] === aiStatus) return;
    this.applyEvent({
      kind: 'ai',
      hash,
      aiStatus,
      reason: detail?.reason,
      error: detail?.error,
    });
  }

  clearLog(): void {
    if (!this.session) return;
    this.session.events = [];
    this.notify();
    this.schedulePersist();
  }

  /**
   * Stop the timer and write the current snapshot immediately.
   */
  async flush(): Promise<void> {
    await this.flushPersist();
  }

  private notify(): void {
    this.onChange?.(this.getSnapshot());
  }

  private schedulePersist(): void {
    if (!this.persistEnabled || this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.flushPersist();
    }, this.persistThrottleMs);
  }

  private async flushPersist(): Promise<void> {
    if (!this.persistEnabled) return;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }

    try {
      await this.storage.set({
        [CAPTURE_SESSION_STORAGE_KEY]: this.getSnapshot(),
      });
    } catch (error) {
      console.warn('[CaptureSession] Failed to persist session snapshot:', error);
    }
  }
}

export function createSessionStorageForTests(): SessionStorage {
  const values: Record<string, unknown> = {};
  return {
    async get(key) {
      return { [key]: values[key] };
    },
    async set(items) {
      Object.assign(values, items);
    },
  };
}
