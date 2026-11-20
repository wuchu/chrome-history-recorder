import { describe, expect, it } from 'vitest';
import {
  describeEvent,
  formatBytes,
  formatDuration,
  matchesEventFilter,
  summaryFromSession,
} from '../src/entrypoints/sidepanel/utils';
import type { SessionEvent } from '../src/shared/extension-runtime';

function event(overrides: Partial<SessionEvent>): SessionEvent {
  return {
    id: 'evt-1',
    sessionId: 'session-1',
    tabId: 1,
    pageUrl: 'https://example.com',
    kind: 'saved',
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('sidepanel utils', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(10 * 1024)).toBe('10 KB');
  });

  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(3_661_000)).toBe('1:01:01');
  });

  it('matches event filters', () => {
    expect(matchesEventFilter(event({ kind: 'saved' }), 'all')).toBe(true);
    expect(matchesEventFilter(event({ kind: 'saved' }), 'saved')).toBe(true);
    expect(matchesEventFilter(event({ kind: 'saved' }), 'failed')).toBe(false);
    expect(matchesEventFilter(event({ kind: 'video:candidate' }), 'video')).toBe(true);
  });

  it('describes events with reasons and sizes', () => {
    expect(describeEvent(event({ kind: 'skipped', reason: 'Too small' }))).toBe('Too small');
    expect(describeEvent(event({ kind: 'failed', error: 'Read failed' }))).toBe('Read failed');
    expect(describeEvent(event({ kind: 'saved', size: 1024, mimeType: 'image/png' }))).toContain(
      '1.0 KB'
    );
  });

  it('builds a fallback summary when none is retained', () => {
    const summary = summaryFromSession(null, {
      startedAt: '2026-01-01T00:00:00.000Z',
      endedAt: '2026-01-01T00:00:05.000Z',
      tabTitle: 'Example',
      pageUrl: 'https://example.com',
      counters: {
        saved: 2,
        duplicate: 1,
        skipped: 3,
        failed: 0,
        bytesSaved: 100,
        imagesSaved: 2,
        videosSaved: 0,
        aiPending: 0,
        aiProcessing: 0,
        aiCompleted: 2,
        aiFailed: 0,
        videosQueued: 0,
        videosDownloading: 0,
      },
    });

    expect(summary?.durationMs).toBe(5000);
    expect(summary?.counters.saved).toBe(2);
    expect(summary?.topReasons).toEqual([]);
  });
});
