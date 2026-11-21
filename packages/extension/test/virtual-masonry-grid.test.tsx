// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import VirtualMasonryGrid from '../src/entrypoints/media-browser/components/VirtualMasonryGrid';
import type { CombinedMediaItem } from '../src/entrypoints/media-browser/hooks/useCombinedMedia';

vi.mock('@virtuoso.dev/masonry', () => ({
  VirtuosoMasonry: () => null,
}));

const item: CombinedMediaItem = {
  hash: 'hash-one',
  mimeType: 'image/png',
  size: 10,
  capturedAt: '2026-01-01T00:00:00.000Z',
  url: 'http://localhost/files/hash-one',
  thumbnailUrl: 'http://localhost/files/hash-one/thumbnail',
};

describe('VirtualMasonryGrid scroll latch', () => {
  let observerCallback: IntersectionObserverCallback | null = null;
  let observerCount = 0;
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

  beforeEach(() => {
    observerCallback = null;
    observerCount = 0;

    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
        observerCount += 1;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    Element.prototype.getBoundingClientRect = () =>
      ({
        width: 900,
        height: 600,
        top: 0,
        left: 0,
        right: 900,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  function trigger() {
    act(() => {
      observerCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
  }

  it('keeps requesting while the end sentinel is visible after a page loads', async () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <VirtualMasonryGrid items={[item]} hasMore loading={false} onLoadMore={onLoadMore} />
    );

    await waitFor(() => expect(observerCount).toBeGreaterThan(0));
    trigger();
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(<VirtualMasonryGrid items={[item]} hasMore loading onLoadMore={onLoadMore} />);
    rerender(<VirtualMasonryGrid items={[item]} hasMore loading={false} onLoadMore={onLoadMore} />);

    await waitFor(() => expect(observerCount).toBeGreaterThan(1));
    trigger();
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });
});
