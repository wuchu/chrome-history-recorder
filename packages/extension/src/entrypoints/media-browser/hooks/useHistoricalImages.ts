/**
 * useHistoricalImages Hook
 *
 * Loads historical media from VFS via the Background Service Worker.
 * Supports search, filters, sorting, and cursor pagination.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { normalizeMediaItem, type VFSRawMediaItem, type NormalizedMediaItem } from '../utils/media';

/**
 * Media item from VFS
 */
export type HistoricalMediaItem = NormalizedMediaItem;

interface VFSListResponse {
  items: VFSRawMediaItem[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Hook options
 */
interface UseHistoricalImagesOptions {
  limit?: number;
  autoLoad?: boolean;
  category?: string;
  tag?: string;
  q?: string;
  mimeType?: 'image' | 'video';
  sourceDomain?: string;
  capturedFrom?: string;
  capturedTo?: string;
  starred?: boolean;
  classifyStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  tags?: string[];
  tagMode?: 'and' | 'or';
  status?: 'active' | 'trashed' | 'all';
  orderBy?:
    | 'captured_at'
    | 'size'
    | 'confidence'
    | 'ai_filename'
    | 'category'
    | 'classified_at'
    | 'deleted_at';
  order?: 'asc' | 'desc';
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
  /** Patch one loaded item without resetting pagination or scroll. */
  updateItem: (hash: string, updates: Partial<HistoricalMediaItem>) => void;
}

/**
 * Hook for loading historical media from VFS via Background
 */
export function useHistoricalImages({
  limit = 50,
  autoLoad = true,
  category,
  tag,
  q,
  mimeType,
  sourceDomain,
  capturedFrom,
  capturedTo,
  starred,
  classifyStatus,
  tags,
  tagMode,
  status,
  orderBy,
  order,
}: UseHistoricalImagesOptions = {}): UseHistoricalImagesReturn {
  const [items, setItems] = useState<HistoricalMediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const cursorRef = useRef<string | undefined>(undefined);
  const offsetRef = useRef(0);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const tagKey = tags?.join(',') ?? '';
  const queryKey = JSON.stringify({
    category,
    tag,
    q,
    mimeType,
    sourceDomain,
    capturedFrom,
    capturedTo,
    starred,
    classifyStatus,
    tagKey,
    tagMode,
    status,
    orderBy,
    order,
    limit,
  });

  /**
   * Load media from Background (VFS)
   */
  const loadImages = useCallback(
    async (reset: boolean = false) => {
      if (!mountedRef.current) return;

      const requestId = ++requestIdRef.current;
      if (reset) {
        cursorRef.current = undefined;
        offsetRef.current = 0;
        setItems([]);
      }

      setLoading(true);
      setError(null);

      try {
        const useCursor = !reset && Boolean(cursorRef.current);
        const offset = offsetRef.current;

        const response = await chrome.runtime.sendMessage({
          type: 'listFiles',
          query: {
            limit,
            offset: useCursor ? undefined : offset,
            cursor: useCursor ? cursorRef.current : undefined,
            category,
            tag,
            q: q?.trim() || undefined,
            mimeType,
            sourceDomain,
            capturedFrom,
            capturedTo,
            starred,
            classifyStatus,
            tags: tags && tags.length > 0 ? tags : undefined,
            tagMode,
            status,
            orderBy,
            order,
          },
        });

        if (requestId !== requestIdRef.current || !mountedRef.current) return;

        if (!response || response.success === false) {
          throw new Error(response?.error || 'Failed to load files');
        }

        const data: VFSListResponse = response.data ?? response;

        const normalizedItems: HistoricalMediaItem[] = data.items
          .map((item) => normalizeMediaItem(item))
          .filter((item): item is NonNullable<typeof item> => item !== null);

        setTotal(data.total);
        setHasMore(data.hasMore);

        setItems((prev) => {
          const base = reset ? [] : prev;
          const seen = new Set(base.map((item) => item.hash));
          const next = [...base];
          for (const item of normalizedItems) {
            if (seen.has(item.hash)) continue;
            seen.add(item.hash);
            next.push(item);
          }
          return next;
        });

        cursorRef.current = data.nextCursor;
        offsetRef.current = (reset ? 0 : offset) + limit;
      } catch (err) {
        if (requestId !== requestIdRef.current || !mountedRef.current) return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('[useHistoricalImages] Error loading images:', message);
      } finally {
        if (requestId === requestIdRef.current && mountedRef.current) {
          setLoading(false);
        }
      }
      // `queryKey` encodes every filter input so callers can pass inline arrays
      // without causing an infinite render loop.
    },
    [queryKey]
  );

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

  const updateItem = useCallback((hash: string, updates: Partial<HistoricalMediaItem>) => {
    setItems((prev) => prev.map((item) => (item.hash === hash ? { ...item, ...updates } : item)));
  }, []);

  /**
   * Auto load on mount and whenever the query changes
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
    updateItem,
  };
}

export default useHistoricalImages;
