/**
 * useColumnCount Hook
 *
 * Calculates responsive column count for the Masonry grid based on the live
 * container width.
 *
 *   columns = floor((width + gap) / (columnWidth + gap))
 *
 * - Minimum 1 column (degrades gracefully on extremely narrow containers).
 * - No upper bound — the column count grows with the container.
 *
 * Implementation notes:
 * - Uses `useLayoutEffect` so the first measurement happens before paint.
 * - Polls via `requestAnimationFrame` until the container actually has a
 *   non-zero layout width. DevTools panels can mount with width=0 because the
 *   parent flex/iframe hasn't measured yet, which would otherwise leave the
 *   `ResizeObserver` listening on a never-resizing element.
 */

import { useLayoutEffect, useState } from 'react';

interface UseColumnCountOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  /** Target column width in pixels. */
  columnWidth?: number;
  /** Gap between columns in pixels. */
  gap?: number;
}

interface UseColumnCountReturn {
  columnCount: number;
  containerWidth: number;
}

function calculateColumns(width: number, columnWidth: number, gap: number): number {
  if (width <= 0) return 1;
  const columns = Math.floor((width + gap) / (columnWidth + gap));
  return Math.max(1, columns);
}

export function useColumnCount({
  containerRef,
  columnWidth = 200,
  gap = 10,
}: UseColumnCountOptions): UseColumnCountReturn {
  const [columnCount, setColumnCount] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);

  useLayoutEffect(() => {
    let rafId = 0;
    let observer: ResizeObserver | null = null;
    let cancelled = false;

    const apply = (rawWidth: number) => {
      if (cancelled) return;
      const width = Math.max(0, Math.round(rawWidth));
      const columns = calculateColumns(width, columnWidth, gap);
      setContainerWidth(width);
      setColumnCount(columns);
    };

    const setup = () => {
      if (cancelled) return;

      const el = containerRef.current;
      if (!el) {
        rafId = requestAnimationFrame(setup);
        return;
      }

      const initialWidth = el.getBoundingClientRect().width;
      if (initialWidth <= 0) {
        // Layout not flushed yet (common inside DevTools panels). Retry next frame.
        rafId = requestAnimationFrame(setup);
        return;
      }

      apply(initialWidth);

      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const inlineSize = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
          apply(inlineSize);
        }
      });

      observer.observe(el);
    };

    setup();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [containerRef, columnWidth, gap]);

  return { columnCount, containerWidth };
}

export default useColumnCount;
