// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useHistoricalImages } from '../src/entrypoints/media-browser/hooks/useHistoricalImages';

function raw(hash: string) {
  return {
    hash,
    mime_type: 'image/png',
    size: 1,
    captured_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('useHistoricalImages query fields', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: vi.fn(async (message: { query?: { terms?: string[] } }) => {
          if (message.query?.terms?.includes('cat')) {
            return {
              success: true,
              data: {
                items: [raw('a')],
                total: 2,
                hasMore: true,
                nextCursor: 'cursor-1',
              },
            };
          }
          return {
            success: true,
            data: {
              items: [raw('b')],
              total: 1,
              hasMore: false,
            },
          };
        }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes terms and exclusions to the background list query', async () => {
    renderHook(() => useHistoricalImages({ limit: 10, terms: ['cat'], excludeTerms: ['nsfw'] }));

    await waitFor(() => expect(chrome.runtime.sendMessage).toHaveBeenCalled());
    expect(vi.mocked(chrome.runtime.sendMessage).mock.calls[0][0]).toMatchObject({
      type: 'listFiles',
      query: { terms: ['cat'], excludeTerms: ['nsfw'], limit: 10, offset: 0 },
    });
  });

  it('resets pagination when the query changes', async () => {
    const { result, rerender } = renderHook(
      (props: { terms: string[] }) => useHistoricalImages({ limit: 10, ...props }),
      { initialProps: { terms: ['cat'] } }
    );

    await waitFor(() => expect(result.current.hasMore).toBe(true));
    act(() => {
      result.current.loadMore();
    });
    await waitFor(() =>
      expect(vi.mocked(chrome.runtime.sendMessage).mock.calls.length).toBeGreaterThan(1)
    );

    rerender({ terms: ['dog'] });
    await waitFor(() => {
      const calls = vi.mocked(chrome.runtime.sendMessage).mock.calls;
      expect(calls[calls.length - 1][0]).toMatchObject({
        type: 'listFiles',
        query: { terms: ['dog'], limit: 10, offset: 0 },
      });
      expect(calls[calls.length - 1][0].query.cursor).toBeUndefined();
    });
  });
});
