// @vitest-environment jsdom
import { useRef } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useColumnCount } from '../src/entrypoints/media-browser/hooks/useColumnCount';

interface ObserverRecord {
  callback: ResizeObserverCallback;
  disconnect: () => void;
}

let observers: ObserverRecord[] = [];

class MockResizeObserver {
  private record: ObserverRecord;

  constructor(callback: ResizeObserverCallback) {
    this.record = { callback, disconnect: () => {} };
    observers.push(this.record);
  }

  observe() {}

  unobserve() {}

  disconnect() {}
}

const originalResizeObserver = global.ResizeObserver;

beforeAll(() => {
  global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
});

afterAll(() => {
  global.ResizeObserver = originalResizeObserver;
});

beforeEach(() => {
  observers = [];
});

function makeEntry(width: number): ResizeObserverEntry {
  return { contentRect: { width } } as ResizeObserverEntry;
}

function renderColumnCount(width: number) {
  const element = document.createElement('div');
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    width,
    height: 600,
    top: 0,
    left: 0,
    right: width,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);

  return renderHook(() => {
    const ref = useRef<HTMLElement | null>(element);
    return useColumnCount({ containerRef: ref, columnWidth: 200, gap: 10 });
  });
}

describe('useColumnCount', () => {
  it('computes columns from the measured width', () => {
    const { result } = renderColumnCount(900);

    expect(result.current.containerWidth).toBe(900);
    expect(result.current.columnCount).toBe(4);
  });

  it('reports zero width while the pane is hidden', () => {
    const { result } = renderColumnCount(700);
    expect(result.current.columnCount).toBe(3);

    const observer = observers[0];
    act(() => {
      observer.callback([makeEntry(0)], {} as ResizeObserver);
    });

    // Consumers use this to unmount the grid; keeping it mounted while hidden
    // makes the virtualizer drop every item.
    expect(result.current.containerWidth).toBe(0);
    expect(result.current.columnCount).toBe(1);
  });

  it('still follows real resizes after a zero-width update', () => {
    const { result } = renderColumnCount(900);
    const observer = observers[0];

    act(() => {
      observer.callback([makeEntry(0)], {} as ResizeObserver);
      observer.callback([makeEntry(400)], {} as ResizeObserver);
    });

    expect(result.current.containerWidth).toBe(400);
    expect(result.current.columnCount).toBe(1);
  });
});
