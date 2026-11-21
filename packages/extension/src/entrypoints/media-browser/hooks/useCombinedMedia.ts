/**
 * useCombinedMedia Hook
 *
 * Combines historical images from VFS with Background real-time data.
 *
 * Background events are processed incrementally into maps instead of being
 * rescanned on every render. The event log itself is capped by the messaging
 * hook, so a long capture session stays bounded.
 */

import { useMemo, useRef } from 'react';
import type { HistoricalMediaItem } from './useHistoricalImages';
import type { BackgroundEvent } from './useBackgroundMessaging';
import { buildVfsFileUrl, buildVfsThumbnailUrl } from '../utils/media';

/**
 * Classification event data
 */
interface ClassifyEventData {
  hash: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  category?: string;
  confidence?: number;
  tags?: string[];
  ai_filename?: string;
  classified_at?: string;
  model_used?: string;
}

/**
 * Combined media item
 */
export type CombinedMediaItem = HistoricalMediaItem & {
  url?: string;
  capturedAt?: string;
};

/**
 * Hook options
 */
interface UseCombinedMediaOptions {
  historicalItems: HistoricalMediaItem[];
  backgroundEvents: BackgroundEvent[];
}

/**
 * Hook return type
 */
interface UseCombinedMediaReturn {
  items: CombinedMediaItem[];
  newItemCount: number;
}

interface LiveCache {
  processed: number;
  firstTimestamp?: string;
  captured: Map<string, HistoricalMediaItem>;
  status: Map<string, ClassifyEventData>;
  trashed: Set<string>;
}

function createCache(): LiveCache {
  return {
    processed: 0,
    captured: new Map(),
    status: new Map(),
    trashed: new Set(),
  };
}

function applyEvent(cache: LiveCache, event: BackgroundEvent): void {
  const data = event.data as Record<string, unknown> | null;
  if (!data) return;
  const hash = typeof data.hash === 'string' ? data.hash : undefined;

  switch (event.type) {
    case 'file:captured': {
      if (!hash || typeof data.mimeType !== 'string') return;
      cache.trashed.delete(hash);
      cache.captured.set(hash, {
        hash,
        mimeType: data.mimeType,
        size: typeof data.size === 'number' ? data.size : 0,
        capturedAt:
          typeof data.capturedAt === 'string' ? data.capturedAt : new Date().toISOString(),
        category: 'uncategorized',
        classifyStatus: 'pending',
        url: buildVfsFileUrl(hash),
        thumbnailUrl: buildVfsThumbnailUrl(hash),
        sourceUrl: typeof data.sourceUrl === 'string' ? data.sourceUrl : undefined,
        sourceDomain: typeof data.sourceDomain === 'string' ? data.sourceDomain : undefined,
      });
      return;
    }
    case 'classify:queued':
      if (hash) cache.status.set(hash, { hash, status: 'pending' });
      return;
    case 'classify:started':
      if (hash) cache.status.set(hash, { hash, status: 'processing' });
      return;
    case 'classify:complete':
    case 'file:classified': {
      if (!hash) return;
      cache.status.set(hash, {
        hash,
        status: 'completed',
        category: typeof data.category === 'string' ? data.category : undefined,
        confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
        tags: Array.isArray(data.tags) ? (data.tags as string[]) : undefined,
        ai_filename: typeof data.ai_filename === 'string' ? data.ai_filename : undefined,
        classified_at: typeof data.classified_at === 'string' ? data.classified_at : undefined,
        model_used: typeof data.model_used === 'string' ? data.model_used : undefined,
      });
      return;
    }
    case 'classify:failed':
      if (hash) cache.status.set(hash, { hash, status: 'failed' });
      return;
    case 'classify:skipped':
      if (hash) cache.status.set(hash, { hash, status: 'skipped' });
      return;
    case 'task:skipped':
      if (hash && data.task_type === 'classify') {
        const previous = cache.status.get(hash) ?? { hash };
        cache.status.set(hash, { ...previous, status: 'skipped' });
      }
      return;
    case 'rename:complete':
    case 'rename:failed': {
      if (!hash) return;
      const previous = cache.status.get(hash) ?? { hash };
      cache.status.set(hash, {
        ...previous,
        ai_filename: typeof data.ai_filename === 'string' ? data.ai_filename : previous.ai_filename,
      });
      return;
    }
    case 'task:completed': {
      if (!hash) return;
      const previous = cache.status.get(hash) ?? { hash };
      if (data.task_type === 'rename') {
        cache.status.set(hash, {
          ...previous,
          ai_filename:
            typeof data.ai_filename === 'string' ? data.ai_filename : previous.ai_filename,
        });
      } else if (data.task_type === 'classify') {
        cache.status.set(hash, {
          ...previous,
          status: 'completed',
          tags: Array.isArray(data.tags) ? (data.tags as string[]) : previous.tags,
          confidence: typeof data.confidence === 'number' ? data.confidence : previous.confidence,
        });
      }
      return;
    }
    case 'file:trashed':
      if (hash) cache.trashed.add(hash);
      return;
    case 'file:restored':
      if (hash) cache.trashed.delete(hash);
      return;
    default:
      return;
  }
}

function withStatus(
  item: HistoricalMediaItem,
  status: ClassifyEventData | undefined
): CombinedMediaItem {
  if (!status) return item;
  return {
    ...item,
    classifyStatus: status.status || item.classifyStatus,
    category: status.category || item.category,
    confidence: status.confidence ?? item.confidence,
    tags: status.tags || item.tags,
    ai_filename: status.ai_filename || item.ai_filename,
    classified_at: status.classified_at || item.classified_at,
    model_used: status.model_used || item.model_used,
  };
}

/**
 * Hook for combining historical and Background data
 */
export function useCombinedMedia({
  historicalItems,
  backgroundEvents,
}: UseCombinedMediaOptions): UseCombinedMediaReturn {
  const cacheRef = useRef<LiveCache>(createCache());

  return useMemo(() => {
    const cache = cacheRef.current;
    const first = backgroundEvents[0];

    // The event list can be cleared or shifted by the capped log. Rebuild the
    // derived maps when the processed prefix is no longer valid.
    if (
      backgroundEvents.length < cache.processed ||
      (cache.processed > 0 && first && cache.firstTimestamp !== first.timestamp)
    ) {
      cacheRef.current = createCache();
    }

    const active = cacheRef.current;
    for (let index = active.processed; index < backgroundEvents.length; index += 1) {
      applyEvent(active, backgroundEvents[index]);
    }
    active.processed = backgroundEvents.length;
    active.firstTimestamp = first?.timestamp;

    const historicalHashes = new Set(historicalItems.map((item) => item.hash));
    const liveItems = [...active.captured.values()]
      .filter((item) => !historicalHashes.has(item.hash) && !active.trashed.has(item.hash))
      .reverse()
      .map((item) => withStatus(item, active.status.get(item.hash)));

    const historyWithUpdates = historicalItems
      .filter((item) => !active.trashed.has(item.hash))
      .map((item) => withStatus(item, active.status.get(item.hash)));

    const combined = [...liveItems, ...historyWithUpdates].filter((item) => {
      const valid = Boolean(item?.hash && item?.mimeType);
      if (!valid) {
        console.warn('[useCombinedMedia] Dropping invalid media item:', item);
      }
      return valid;
    });

    return {
      items: combined,
      newItemCount: liveItems.length,
    };
  }, [historicalItems, backgroundEvents]);
}

export default useCombinedMedia;
