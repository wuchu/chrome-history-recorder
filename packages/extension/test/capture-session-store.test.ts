import { describe, expect, it } from 'vitest';
import {
  CaptureSessionStore,
  createSessionStorageForTests,
  MAX_SESSION_EVENTS,
} from '../src/background/capture-session-store';

function createClock(start = '2026-01-01T00:00:00.000Z') {
  let current = new Date(start).getTime();
  return {
    now: () => new Date(current),
    advance: (ms: number) => {
      current += ms;
    },
  };
}

function createStore(
  overrides: { persist?: boolean; storage?: ReturnType<typeof createSessionStorageForTests> } = {}
) {
  const clock = createClock();
  const store = new CaptureSessionStore({
    now: clock.now,
    persist: overrides.persist ?? false,
    storage: overrides.storage ?? createSessionStorageForTests(),
    persistThrottleMs: 1,
  });
  return { store, clock };
}

function start(store: CaptureSessionStore, tabId = 1) {
  return store.start({
    tabId,
    windowId: 10,
    tabTitle: 'Example',
    pageUrl: 'https://example.com/page',
    origin: 'https://example.com',
  });
}

describe('CaptureSessionStore', () => {
  it('starts a session with empty counters and identity', () => {
    const { store } = createStore();
    const session = start(store);

    expect(session.status).toBe('capturing');
    expect(session.tabId).toBe(1);
    expect(session.origin).toBe('https://example.com');
    expect(session.counters.saved).toBe(0);
    expect(session.events).toEqual([]);
  });

  it('records saved media and recent items', () => {
    const { store } = createStore();
    start(store);

    store.applyEvent({
      kind: 'saved',
      hash: 'abc',
      mimeType: 'image/png',
      size: 1200,
      sourceUrl: 'https://cdn.example.com/a.png',
    });

    const snapshot = store.getSnapshot();
    expect(snapshot.session?.counters.saved).toBe(1);
    expect(snapshot.session?.counters.bytesSaved).toBe(1200);
    expect(snapshot.session?.counters.imagesSaved).toBe(1);
    expect(snapshot.session?.counters.aiPending).toBe(1);
    expect(snapshot.session?.savedHashes).toEqual(['abc']);
    expect(snapshot.session?.recentItems[0]).toMatchObject({ hash: 'abc', aiStatus: 'pending' });
    expect(snapshot.session?.events[0].kind).toBe('saved');
  });

  it('records duplicates without counting them as saved', () => {
    const { store } = createStore();
    start(store);

    store.applyEvent({
      kind: 'duplicate',
      hash: 'abc',
      mimeType: 'image/png',
      reason: 'Content already exists',
    });

    const snapshot = store.getSnapshot();
    expect(snapshot.session?.counters.saved).toBe(0);
    expect(snapshot.session?.counters.duplicate).toBe(1);
    expect(snapshot.session?.recentItems[0]).toMatchObject({ hash: 'abc', duplicate: true });
  });

  it('counts skipped and failed events', () => {
    const { store } = createStore();
    start(store);

    store.applyEvent({ kind: 'skipped', reason: 'SVG images are skipped' });
    store.applyEvent({ kind: 'failed', error: 'Read failed' });

    const snapshot = store.getSnapshot();
    expect(snapshot.session?.counters.skipped).toBe(1);
    expect(snapshot.session?.counters.failed).toBe(1);
  });

  it('correlates AI events only to hashes saved in the session', () => {
    const { store } = createStore();
    start(store);
    store.applyEvent({ kind: 'saved', hash: 'abc', mimeType: 'image/png', size: 10 });

    store.recordAiStatus('missing', 'completed');
    expect(store.getSnapshot().session?.counters.aiCompleted).toBe(0);

    store.recordAiStatus('abc', 'processing');
    expect(store.getSnapshot().session?.counters.aiPending).toBe(0);
    expect(store.getSnapshot().session?.counters.aiProcessing).toBe(1);

    store.recordAiStatus('abc', 'completed');
    expect(store.getSnapshot().session?.counters.aiProcessing).toBe(0);
    expect(store.getSnapshot().session?.counters.aiCompleted).toBe(1);
  });

  it('applies AI events that arrive before the saved event', () => {
    const { store } = createStore();
    start(store);

    store.recordAiStatus('abc', 'completed');
    store.applyEvent({ kind: 'saved', hash: 'abc', mimeType: 'image/png', size: 10 });

    const snapshot = store.getSnapshot();
    expect(snapshot.session?.counters.aiCompleted).toBe(1);
    expect(snapshot.session?.counters.aiPending).toBe(0);
  });

  it('bounds the event log to the newest 200 entries', () => {
    const { store } = createStore();
    start(store);

    for (let index = 0; index < MAX_SESSION_EVENTS + 20; index += 1) {
      store.applyEvent({ kind: 'skipped', reason: `reason-${index}` });
    }

    const events = store.getSnapshot().session?.events ?? [];
    expect(events).toHaveLength(MAX_SESSION_EVENTS);
    expect(events[0].reason).toBe(`reason-${MAX_SESSION_EVENTS + 19}`);
    expect(events.at(-1)?.reason).toBe('reason-20');
  });

  it('keeps counters when the log is cleared', () => {
    const { store } = createStore();
    start(store);
    store.applyEvent({ kind: 'saved', hash: 'abc', mimeType: 'image/png', size: 10 });

    store.clearLog();

    const snapshot = store.getSnapshot();
    expect(snapshot.session?.events).toEqual([]);
    expect(snapshot.session?.counters.saved).toBe(1);
  });

  it('builds a summary with the most frequent reasons', () => {
    const { store, clock } = createStore();
    start(store);
    store.applyEvent({ kind: 'skipped', reason: 'Too small' });
    store.applyEvent({ kind: 'skipped', reason: 'Too small' });
    store.applyEvent({ kind: 'skipped', reason: 'SVG' });
    store.applyEvent({ kind: 'failed', error: 'Read failed' });
    store.applyEvent({ kind: 'saved', hash: 'abc', mimeType: 'image/png', size: 42 });

    clock.advance(5000);
    const snapshot = store.end('stopped');

    expect(snapshot.summary?.durationMs).toBe(5000);
    expect(snapshot.summary?.counters.saved).toBe(1);
    expect(snapshot.summary?.topReasons[0]).toEqual({ reason: 'Too small', count: 2 });
  });

  it('replaces the previous session and retains its summary', () => {
    const { store, clock } = createStore();
    start(store, 1);
    store.applyEvent({ kind: 'saved', hash: 'old', mimeType: 'image/png', size: 10 });
    clock.advance(1000);

    const next = start(store, 2);

    expect(next.tabId).toBe(2);
    expect(next.counters.saved).toBe(0);
    expect(store.getSnapshot().summary?.tabId).toBe(1);
    expect(store.getActiveSession()?.tabId).toBe(2);
  });

  it('restores a session snapshot from storage', async () => {
    const storage = createSessionStorageForTests();
    const { store } = createStore({ persist: true, storage });
    start(store);
    store.applyEvent({ kind: 'saved', hash: 'abc', mimeType: 'image/png', size: 10 });
    await store.flush();

    const restored = new CaptureSessionStore({
      storage,
      persist: true,
      persistThrottleMs: 1,
    });
    await restored.restore();

    expect(restored.getActiveSession()?.tabId).toBe(1);
    expect(restored.getSnapshot().session?.counters.saved).toBe(1);
    expect(restored.hasSavedHash('abc')).toBe(true);
  });

  it('tracks video queue and download counters', () => {
    const { store } = createStore();
    start(store);

    store.recordVideoCandidate({
      url: 'https://example.com/a.mp4',
      mimeType: 'video/mp4',
      size: 100,
    });
    expect(store.getSnapshot().session?.counters.videosQueued).toBe(1);

    store.recordVideoDownloadStarted();
    expect(store.getSnapshot().session?.counters.videosQueued).toBe(0);
    expect(store.getSnapshot().session?.counters.videosDownloading).toBe(1);

    store.recordVideoResult({
      hash: 'vid',
      mimeType: 'video/mp4',
      size: 100,
      url: 'https://example.com/a.mp4',
    });
    const snapshot = store.getSnapshot();
    expect(snapshot.session?.counters.videosDownloading).toBe(0);
    expect(snapshot.session?.counters.videosSaved).toBe(1);
    expect(snapshot.session?.counters.saved).toBe(1);
  });

  it('ignores events after the session stops', () => {
    const { store } = createStore();
    start(store);
    store.end('stopped');

    store.applyEvent({ kind: 'saved', hash: 'late', mimeType: 'image/png', size: 10 });

    expect(store.getSnapshot().session?.counters.saved).toBe(0);
  });
});
