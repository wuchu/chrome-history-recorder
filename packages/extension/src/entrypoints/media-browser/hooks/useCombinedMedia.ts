/**
 * useCombinedMedia Hook
 *
 * Combines historical images from VFS with Background real-time data.
 */

import { useMemo } from 'react';
import type { HistoricalMediaItem } from './useHistoricalImages';
import type { BackgroundEvent } from './useBackgroundMessaging';
import { buildVfsFileUrl, buildVfsThumbnailUrl } from '../utils/media';

/**
 * Classification event data
 */
interface ClassifyEventData {
  hash: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
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

/**
 * Extract file:captured events from Background
 */
function extractCapturedFiles(events: BackgroundEvent[]): HistoricalMediaItem[] {
  return events
    .filter((e) => e.type === 'file:captured')
    .map((e) => {
      const data = e.data as {
        hash: string;
        mimeType: string;
        size: number;
        capturedAt?: string;
      };
      return {
        hash: data.hash,
        mimeType: data.mimeType,
        size: data.size,
        capturedAt: data.capturedAt ?? new Date().toISOString(),
        category: 'uncategorized',
        classifyStatus: 'pending' as const,
        url: buildVfsFileUrl(data.hash),
        thumbnailUrl: buildVfsThumbnailUrl(data.hash),
      };
    });
}

/**
 * Extract classify status from Background events
 */
function extractClassifyStatus(events: BackgroundEvent[]): Record<string, ClassifyEventData> {
  const status: Record<string, ClassifyEventData> = {};

  for (const event of events) {
    if (event.type === 'classify:queued') {
      const data = event.data as { hash: string };
      status[data.hash] = { hash: data.hash, status: 'pending' };
    } else if (event.type === 'classify:started') {
      const data = event.data as { hash: string };
      status[data.hash] = { hash: data.hash, status: 'processing' };
    } else if (event.type === 'classify:complete' || event.type === 'file:classified') {
      const data = event.data as {
        hash: string;
        category: string;
        confidence?: number;
        tags?: string[];
        ai_filename?: string;
        classified_at?: string;
        model_used?: string;
      };
      status[data.hash] = {
        hash: data.hash,
        status: 'completed',
        category: data.category,
        confidence: data.confidence,
        tags: data.tags,
        ai_filename: data.ai_filename,
        classified_at: data.classified_at,
        model_used: data.model_used,
      };
    } else if (event.type === 'classify:failed') {
      const data = event.data as { hash: string };
      status[data.hash] = { hash: data.hash, status: 'failed' };
    }
  }

  return status;
}

/**
 * Hook for combining historical and Background data
 */
export function useCombinedMedia({
  historicalItems,
  backgroundEvents,
}: UseCombinedMediaOptions): UseCombinedMediaReturn {
  return useMemo(() => {
    // Extract Background data
    const bgCaptured = extractCapturedFiles(backgroundEvents);
    const bgClassifyStatus = extractClassifyStatus(backgroundEvents);

    // 1. Background new files (insert at top, dedupe by hash)
    const newItems = bgCaptured
      .filter((file) => !historicalItems.some((h) => h.hash === file.hash))
      .map((file) => ({
        ...file,
        classifyStatus: bgClassifyStatus[file.hash]?.status || 'pending',
        category: bgClassifyStatus[file.hash]?.category,
        confidence: bgClassifyStatus[file.hash]?.confidence,
        tags: bgClassifyStatus[file.hash]?.tags,
        ai_filename: bgClassifyStatus[file.hash]?.ai_filename,
        classified_at: bgClassifyStatus[file.hash]?.classified_at,
        model_used: bgClassifyStatus[file.hash]?.model_used,
      }));

    // 2. Historical data (with classify status updates)
    const historyWithUpdates = historicalItems.map((item) => ({
      ...item,
      classifyStatus: bgClassifyStatus[item.hash]?.status || item.classifyStatus,
      category: bgClassifyStatus[item.hash]?.category || item.category,
      confidence: bgClassifyStatus[item.hash]?.confidence || item.confidence,
      tags: bgClassifyStatus[item.hash]?.tags || item.tags,
      ai_filename: bgClassifyStatus[item.hash]?.ai_filename || item.ai_filename,
      classified_at: bgClassifyStatus[item.hash]?.classified_at || item.classified_at,
      model_used: bgClassifyStatus[item.hash]?.model_used || item.model_used,
    }));

    // 3. Combine: new files first, then historical
    const combined = [...newItems, ...historyWithUpdates].filter((item) => {
      const valid = Boolean(item?.hash && item?.mimeType);
      if (!valid) {
        console.warn('[useCombinedMedia] Dropping invalid media item:', item);
      }
      return valid;
    });

    return {
      items: combined,
      newItemCount: newItems.length,
    };
  }, [historicalItems, backgroundEvents]);
}

export default useCombinedMedia;
