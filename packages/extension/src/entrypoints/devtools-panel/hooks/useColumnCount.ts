/**
 * useColumnCount Hook
 *
 * Calculates responsive column count for Masonry grid based on container width.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook options
 */
interface UseColumnCountOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  columnWidth?: number; // Width of each column in pixels
  gap?: number; // Gap between columns in pixels
}

/**
 * Hook return type
 */
interface UseColumnCountReturn {
  columnCount: number;
  containerWidth: number;
}

/**
 * Calculate column count from width
 */
function calculateColumns(width: number, columnWidth: number, gap: number): number {
  // Width needed for n columns: n * columnWidth + (n-1) * gap
  // Solve for n: width >= n * columnWidth + (n-1) * gap
  // n <= (width + gap) / (columnWidth + gap)
  const columns = Math.floor((width + gap) / (columnWidth + gap));

  // Minimum 2 columns, maximum 5 columns
  return Math.max(2, Math.min(5, columns));
}

/**
 * Hook for responsive column count
 */
export function useColumnCount({
  containerRef,
  columnWidth = 200,
  gap = 10,
}: UseColumnCountOptions): UseColumnCountReturn {
  const [columnCount, setColumnCount] = useState(3);
  const [containerWidth, setContainerWidth] = useState(0);

  const mountedRef = useRef(true);

  /**
   * Update column count on resize
   */
  const updateColumns = useCallback(() => {
    if (!mountedRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    setContainerWidth(width);
    setColumnCount(calculateColumns(width, columnWidth, gap));
  }, [containerRef, columnWidth, gap]);

  /**
   * Setup ResizeObserver
   */
  useEffect(() => {
    mountedRef.current = true;

    // Initial calculation
    updateColumns();

    // Setup ResizeObserver
    const observer = new ResizeObserver(() => {
      updateColumns();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      mountedRef.current = false;
      observer.disconnect();
    };
  }, [updateColumns]);

  return {
    columnCount,
    containerWidth,
  };
}

export default useColumnCount;