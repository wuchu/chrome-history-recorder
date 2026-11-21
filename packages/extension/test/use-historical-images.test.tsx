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

describe('useHistoricalImages cursor pagination', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: vi.fn(async (message: { query?: { cursor?: string } }) => {
          if (message.query?.cursor === 'cursor-1') {
            return {
              success: true,
              data: {
                items: [raw('a'), raw('b')],
                total: 2,
                hasMore: false,
                nextCursor: undefined,
              },
            };
          }
          return {
            success: true,
            data: {
              items: [raw('a')],
              total: 2,
              hasMore: true,
              nextCursor: 'cursor-1',
            },
          };
        }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('appends the next cursor page without duplicating hashes', async () => {
    const { result } = renderHook(() => useHistoricalImages({ limit: 1 }));

    await waitFor(() => expect(result.current.items.map((item) => item.hash)).toEqual(['a']));

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.items.map((item) => item.hash)).toEqual(['a', 'b']));
  });

  it('discards a stale response after the query changes', async () => {
    const pending = new Map<string, (value: unknown) => void>();
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      (message: { query?: { q?: string } }) =>
        new Promise((resolve) => {
          pending.set(message.query?.q ?? 'none', resolve as (value: unknown) => void);
        })
    );

    const { result, rerender } = renderHook((props: { q?: string }) => useHistoricalImages(props), {
      initialProps: { q: 'first' },
    });

    await waitFor(() => expect(pending.has('first')).toBe(true));

    rerender({ q: 'second' });
    await waitFor(() => expect(pending.has('second')).toBe(true));

    await act(async () => {
      pending.get('second')?.({
        success: true,
        data: { items: [raw('b')], total: 1, hasMore: false },
      });
    });
    await waitFor(() => expect(result.current.items.map((item) => item.hash)).toEqual(['b']));

    await act(async () => {
      pending.get('first')?.({
        success: true,
        data: { items: [raw('a')], total: 1, hasMore: false },
      });
    });
    await waitFor(() => expect(result.current.items.map((item) => item.hash)).toEqual(['b']));
  });
});
