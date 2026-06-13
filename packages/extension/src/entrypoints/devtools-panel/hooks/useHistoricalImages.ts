/**
 * useHistoricalImages Hook
 *
 * Loads historical images from VFS via Background Service Worker.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { normalizeMediaItem } from '../utils/media';

/**
 * Media item from VFS
 */
export interface HistoricalMediaItem {
  hash: string;
  mimeType: string;
  size: number;
  capturedAt: string;
  category?: string;
  ai_filename?: string;
  tags?: string[];
  confidence?: number;
  classified_at?: string;
  model_used?: string;
  classifyStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  // Additional fields for compatibility
  url?: string;
  thumbnailUrl?: string;
}

/**
 * VFS response structure
 */
interface VFSListResponse {
  items: HistoricalMediaItem[];
  total: number;
  hasMore: boolean;
}

/**
 * Hook options
 */
interface UseHistoricalImagesOptions {
  limit?: number;
  autoLoad?: boolean;
  category?: string;
  tag?: string;
}

/**
 * Hook return type
 */
interface UseHistoricalImagesReturn {
  items: HistoricalMediaItem[];
  total: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

/**
 * Hook for loading historical images from VFS via Background
 */
export function useHistoricalImages({
  limit = 50,
  autoLoad = true,
  category,
  tag,
}: UseHistoricalImagesOptions = {}): UseHistoricalImagesReturn {
  const [items, setItems] = useState<HistoricalMediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const offsetRef = useRef(0);
  const mountedRef = useRef(true);

  /**
   * Load images from Background (VFS)
   */
  const loadImages = useCallback(async (reset: boolean = false) => {
    if (!mountedRef.current) return;

    if (reset) {
      offsetRef.current = 0;
      setItems([]);
    }

    setLoading(true);
    setError(null);

    try {
      const offset = offsetRef.current;

      // Request from Background Service Worker
      const response = await chrome.runtime.sendMessage({
        type: 'listFiles',
        query: {
          limit,
          offset,
          category,
          tag,
        },
      });

      if (!mountedRef.current) return;

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to load files');
      }

      const data: VFSListResponse = response.data;

      const normalizedItems = data.items
        .map((item) => normalizeMediaItem(item as any))
        .filter((item): item is HistoricalMediaItem => item !== null);

      setTotal(data.total);
      setHasMore(data.hasMore);

      if (reset) {
        setItems(normalizedItems);
      } else {
        setItems((prev) => [...prev, ...normalizedItems]);
      }

      offsetRef.current = offset + limit;
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useHistoricalImages] Error loading images:', message);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [limit, category, tag]);

  /**
   * Load more images
   */
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadImages(false);
    }
  }, [loading, hasMore, loadImages]);

  /**
   * Refresh and reload from start
   */
  const refresh = useCallback(() => {
    loadImages(true);
  }, [loadImages]);

  /**
   * Auto load on mount
   */
  useEffect(() => {
    mountedRef.current = true;

    if (autoLoad) {
      loadImages(true);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [autoLoad, loadImages]);

  return {
    items,
    total,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}

export default useHistoricalImages;