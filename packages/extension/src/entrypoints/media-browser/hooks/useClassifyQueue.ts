/**
 * useClassifyQueue Hook
 *
 * Gets classification queue status from Background Service Worker.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { BackgroundEvent } from './useBackgroundMessaging';

/**
 * Classification queue status
 */
export interface SchedulerStatus {
  state: 'running' | 'paused';
  running: boolean;
  processing: number;
  concurrency: number;
}

export interface ClassifyQueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  scheduler?: SchedulerStatus;
}

/**
 * Classification config
 */
export interface ClassifyConfig {
  ollamaEndpoint?: string;
  visionModel?: string;
  language?: string;
  filenameStyle?: string;
  concurrency?: number;
  organizeBy?: string;
}

/**
 * Hook options
 */
interface UseClassifyQueueOptions {
  backgroundEvents?: BackgroundEvent[];
}

/**
 * Hook return type
 */
interface UseClassifyQueueReturn {
  status: ClassifyQueueStatus;
  config: ClassifyConfig;
  loading: boolean;
  error: string | null;
  startClassification: () => Promise<void>;
  pauseClassification: () => Promise<void>;
  retryFailed: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

/**
 * Default queue status
 */
const DEFAULT_STATUS: ClassifyQueueStatus = {
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  total: 0,
};

/**
 * Hook for classification queue status from Background
 */
export function useClassifyQueue({
  backgroundEvents = [],
}: UseClassifyQueueOptions = {}): UseClassifyQueueReturn {
  const [status, setStatus] = useState<ClassifyQueueStatus>(DEFAULT_STATUS);
  const [config, setConfig] = useState<ClassifyConfig>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  /**
   * Fetch queue status from Background
   */
  const fetchStatus = useCallback(async () => {
    if (!mountedRef.current) return;

    setLoading(true);

    try {
      // Request queue status from Background
      const response = await chrome.runtime.sendMessage({ type: 'getQueueStatus' });

      if (mountedRef.current && response) {
        const queueData = response.success ? response.data : response;
        setStatus({
          pending: queueData?.pending || 0,
          processing: queueData?.processing || 0,
          completed: queueData?.completed || 0,
          failed: queueData?.failed || 0,
          total: queueData?.total || 0,
          scheduler: queueData?.scheduler,
        });
      }

      // Request config from Background
      const configResponse = await chrome.runtime.sendMessage({ type: 'getConfig' });

      if (mountedRef.current && configResponse) {
        setConfig(configResponse.success ? configResponse.data : configResponse);
      }

      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useClassifyQueue] Error fetching status:', message);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Start classification processing
   */
  const startClassification = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'startClassification' });
      await fetchStatus();
    } catch (err) {
      console.error('[useClassifyQueue] Start classification failed:', err);
    }
  }, [fetchStatus]);

  /**
   * Pause classification processing
   */
  const pauseClassification = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'pauseClassification' });
      await fetchStatus();
    } catch (err) {
      console.error('[useClassifyQueue] Pause classification failed:', err);
    }
  }, [fetchStatus]);

  /**
   * Retry failed tasks
   */
  const retryFailed = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'retryFailedTasks' });
      // Refresh status after retry
      await fetchStatus();
    } catch (err) {
      console.error('[useClassifyQueue] Retry failed:', err);
    }
  }, [fetchStatus]);

  /**
   * Clear queue
   */
  const clearQueue = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'clearQueue' });
      // Refresh status after clear
      await fetchStatus();
    } catch (err) {
      console.error('[useClassifyQueue] Clear queue failed:', err);
    }
  }, [fetchStatus]);

  /**
   * Initial load and periodic refresh
   */
  useEffect(() => {
    mountedRef.current = true;
    fetchStatus();

    // Poll every 10 seconds
    const interval = setInterval(fetchStatus, 10000);

    return () => {
      clearInterval(interval);
      mountedRef.current = false;
    };
  }, [fetchStatus]);

  /**
   * Update status from Background events
   */
  useEffect(() => {
    for (const event of backgroundEvents) {
      if (event.type === 'classify:scheduler') {
        const scheduler = event.data as SchedulerStatus;
        setStatus((prev) => ({ ...prev, scheduler }));
      } else if (event.type === 'queue:updated') {
        const data = event.data as Partial<ClassifyQueueStatus>;
        setStatus((prev) => ({
          ...prev,
          pending: data.pending ?? prev.pending,
          processing: data.processing ?? prev.processing,
          completed: data.completed ?? prev.completed,
          failed: data.failed ?? prev.failed,
          total: data.total ?? prev.total,
          scheduler: data.scheduler ?? prev.scheduler,
        }));
      } else if (event.type === 'classify:queued') {
        setStatus((prev) => ({
          ...prev,
          pending: prev.pending + 1,
          total: prev.total + 1,
        }));
      } else if (event.type === 'classify:started') {
        setStatus((prev) => ({
          ...prev,
          pending: Math.max(0, prev.pending - 1),
          processing: prev.processing + 1,
        }));
      } else if (event.type === 'classify:complete' || event.type === 'file:classified') {
        setStatus((prev) => ({
          ...prev,
          processing: Math.max(0, prev.processing - 1),
          completed: prev.completed + 1,
        }));
      } else if (event.type === 'classify:failed') {
        setStatus((prev) => ({
          ...prev,
          processing: Math.max(0, prev.processing - 1),
          failed: prev.failed + 1,
        }));
      }
    }
  }, [backgroundEvents]);

  return {
    status,
    config,
    loading,
    error,
    startClassification,
    pauseClassification,
    retryFailed,
    clearQueue,
  };
}

export default useClassifyQueue;
