// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useCombinedMedia,
  type CombinedMediaItem,
} from '../src/entrypoints/media-browser/hooks/useCombinedMedia';
import type { HistoricalMediaItem } from '../src/entrypoints/media-browser/hooks/useHistoricalImages';
import type { BackgroundEvent } from '../src/entrypoints/media-browser/hooks/useBackgroundMessaging';

const historical: HistoricalMediaItem[] = [
  {
    hash: 'history-one',
    mimeType: 'image/png',
    size: 10,
    capturedAt: '2026-01-01T00:00:00.000Z',
    url: 'http://localhost/files/history-one',
    thumbnailUrl: 'http://localhost/files/history-one/thumbnail',
  },
];

function event(type: string, data: Record<string, unknown>): BackgroundEvent {
  return { type, data, timestamp: '2026-01-01T00:00:01.000Z' };
}

function hashes(items: CombinedMediaItem[]): string[] {
  return items.map((item) => item.hash);
}

describe('useCombinedMedia', () => {
  it('merges live captures, updates status, and removes trashed items', () => {
    const { result, rerender } = renderHook(
      (props: { historicalItems: HistoricalMediaItem[]; backgroundEvents: BackgroundEvent[] }) =>
        useCombinedMedia(props),
      { initialProps: { historicalItems: historical, backgroundEvents: [] } }
    );

    expect(hashes(result.current.items)).toEqual(['history-one']);

    const captured = event('file:captured', {
      hash: 'live-one',
      mimeType: 'image/png',
      size: 20,
      sourceUrl: 'https://example.com/a.png',
    });
    rerender({ historicalItems: historical, backgroundEvents: [captured] });
    expect(hashes(result.current.items)).toEqual(['live-one', 'history-one']);
    expect(result.current.newItemCount).toBe(1);

    const classified = event('classify:complete', {
      hash: 'live-one',
      tags: ['cat'],
      confidence: 0.9,
      ai_filename: 'a cat',
    });
    rerender({ historicalItems: historical, backgroundEvents: [captured, classified] });
    expect(result.current.items[0].tags).toEqual(['cat']);
    expect(result.current.items[0].ai_filename).toBe('a cat');

    // A historical refresh that includes the live item must not duplicate it.
    const refreshed = [
      ...historical,
      {
        hash: 'live-one',
        mimeType: 'image/png',
        size: 20,
        capturedAt: '2026-01-01T00:00:01.000Z',
        url: 'http://localhost/files/live-one',
        thumbnailUrl: 'http://localhost/files/live-one/thumbnail',
      },
    ];
    rerender({ historicalItems: refreshed, backgroundEvents: [captured, classified] });
    expect(hashes(result.current.items).filter((hash) => hash === 'live-one')).toHaveLength(1);

    const trashed = event('file:trashed', { hash: 'live-one' });
    rerender({
      historicalItems: refreshed,
      backgroundEvents: [captured, classified, trashed],
    });
    expect(hashes(result.current.items)).toEqual(['history-one']);
  });
});
