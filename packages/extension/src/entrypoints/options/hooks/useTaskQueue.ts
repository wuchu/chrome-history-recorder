import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearQueue as clearQueueRequest,
  getQueueStatus,
  pauseClassification,
  QueueStatus,
  refreshAllTasks,
  retryFailedTasks,
  SchedulerStatus,
  startClassification,
  TaskType,
} from '../../../shared/extension-runtime';

const DEFAULT_STATUS: QueueStatus = {
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  skipped: 0,
  total: 0,
};

export type TaskActionKey = 'start' | 'pause' | 'retry' | 'clear' | 'rescan';

export interface UseTaskQueueReturn {
  status: QueueStatus;
  loading: boolean;
  busy: Record<TaskActionKey, boolean>;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  retryFailed: () => Promise<void>;
  clearQueue: () => Promise<void>;
  requeueAll: (taskTypes?: TaskType[]) => Promise<number>;
  refresh: () => Promise<void>;
}

/**
 * Event-driven AI task queue status for the Options page.
 *
 * Subscribes to Background broadcasts and treats `queue:updated` as the
 * authoritative full snapshot (aggregate + `byType` + `scheduler`), with
 * `*:scheduler` events applied as scheduler-only updates.
 */
export function useTaskQueue(): UseTaskQueueReturn {
  const [status, setStatus] = useState<QueueStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<TaskActionKey | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await getQueueStatus();
      if (mountedRef.current) {
        setStatus({
          pending: next.pending ?? 0,
          processing: next.processing ?? 0,
          completed: next.completed ?? 0,
          failed: next.failed ?? 0,
          skipped: next.skipped ?? 0,
          total: next.total ?? 0,
          scheduler: next.scheduler,
          byType: next.byType,
        });
      }
    } catch (error) {
      console.warn('[useTaskQueue] Failed to refresh queue status:', error);
    }
  }, []);

  // Initial load so a freshly opened Options page reflects current state.
  useEffect(() => {
    mountedRef.current = true;
    void (async () => {
      await refresh();
      if (mountedRef.current) setLoading(false);
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  // Live updates from Background broadcasts.
  useEffect(() => {
    const handleMessage = (message: unknown) => {
      const msg = message as { type?: string; data?: unknown };
      if (msg.type === 'queue:updated') {
        const data = (msg.data ?? {}) as Partial<QueueStatus>;
        setStatus((prev) => ({
          pending: data.pending ?? prev.pending,
          processing: data.processing ?? prev.processing,
          completed: data.completed ?? prev.completed,
          failed: data.failed ?? prev.failed,
          skipped: data.skipped ?? prev.skipped,
          total: data.total ?? prev.total,
          scheduler: (data.scheduler as SchedulerStatus | undefined) ?? prev.scheduler,
          byType: data.byType ?? prev.byType,
        }));
      } else if (msg.type === 'task:scheduler' || msg.type === 'classify:scheduler') {
        const scheduler = msg.data as SchedulerStatus | undefined;
        if (scheduler) setStatus((prev) => ({ ...prev, scheduler }));
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const run = useCallback(async (key: TaskActionKey, action: () => Promise<unknown>) => {
    setBusyAction(key);
    try {
      await action();
    } finally {
      setBusyAction(null);
    }
  }, []);

  const start = useCallback(async () => {
    await run('start', async () => {
      const scheduler = await startClassification();
      setStatus((prev) => ({ ...prev, scheduler }));
    });
  }, [run]);

  const pause = useCallback(async () => {
    await run('pause', async () => {
      const scheduler = await pauseClassification();
      setStatus((prev) => ({ ...prev, scheduler }));
    });
  }, [run]);

  const retryFailed = useCallback(async () => {
    await run('retry', async () => {
      await retryFailedTasks();
      await refresh();
    });
  }, [run, refresh]);

  const clearQueue = useCallback(async () => {
    await run('clear', async () => {
      await clearQueueRequest();
      await refresh();
    });
  }, [run, refresh]);

  const requeueAll = useCallback(
    async (taskTypes: TaskType[] = ['classify', 'rename']): Promise<number> => {
      let count = 0;
      await run('rescan', async () => {
        count = await refreshAllTasks(taskTypes);
        await refresh();
      });
      return count;
    },
    [run, refresh]
  );

  const busy = useMemo<Record<TaskActionKey, boolean>>(
    () => ({
      start: busyAction === 'start',
      pause: busyAction === 'pause',
      retry: busyAction === 'retry',
      clear: busyAction === 'clear',
      rescan: busyAction === 'rescan',
    }),
    [busyAction]
  );

  return { status, loading, busy, start, pause, retryFailed, clearQueue, requeueAll, refresh };
}
