import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearQueue as clearQueueRequest,
  getQueueStatus,
  QueueStatus,
  refreshAllTasks,
  retryFailedTasks,
  SchedulerStatus,
  setTaskPaused,
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

export type AiTaskType = 'classify' | 'rename';
export type TaskActionType = 'start' | 'pause' | 'retry' | 'clear' | 'rescan';
export type TaskActionKey = `${AiTaskType}:${TaskActionType}`;

const AI_TASK_TYPES: AiTaskType[] = ['classify', 'rename'];
const TASK_ACTIONS: TaskActionType[] = ['start', 'pause', 'retry', 'clear', 'rescan'];

export interface UseTaskQueueReturn {
  status: QueueStatus;
  loading: boolean;
  busy: Record<TaskActionKey, boolean>;
  start: (taskType: AiTaskType) => Promise<void>;
  pause: (taskType: AiTaskType) => Promise<void>;
  retryFailed: (taskType: AiTaskType) => Promise<void>;
  clearQueue: (taskType: AiTaskType) => Promise<void>;
  requeueAll: (taskTypes?: AiTaskType[]) => Promise<number>;
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
  const [busyAction, setBusyAction] = useState<string | null>(null);
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

  const start = useCallback(
    async (taskType: AiTaskType) => {
      await run(`${taskType}:start`, async () => {
        const scheduler = await setTaskPaused(taskType, false);
        setStatus((prev) => ({ ...prev, scheduler }));
      });
    },
    [run]
  );

  const pause = useCallback(
    async (taskType: AiTaskType) => {
      await run(`${taskType}:pause`, async () => {
        const scheduler = await setTaskPaused(taskType, true);
        setStatus((prev) => ({ ...prev, scheduler }));
      });
    },
    [run]
  );

  const retryFailed = useCallback(
    async (taskType: AiTaskType) => {
      await run(`${taskType}:retry`, async () => {
        await retryFailedTasks(taskType as TaskType);
        await refresh();
      });
    },
    [run, refresh]
  );

  const clearQueue = useCallback(
    async (taskType: AiTaskType) => {
      await run(`${taskType}:clear`, async () => {
        await clearQueueRequest(taskType as TaskType);
        await refresh();
      });
    },
    [run, refresh]
  );

  const requeueAll = useCallback(
    async (taskTypes: AiTaskType[] = ['classify', 'rename']): Promise<number> => {
      let count = 0;
      const key: TaskActionKey =
        taskTypes.length === 1 ? `${taskTypes[0]}:rescan` : 'classify:rescan';
      await run(key, async () => {
        count = await refreshAllTasks(taskTypes as TaskType[]);
        await refresh();
      });
      return count;
    },
    [run, refresh]
  );

  const busy = useMemo(() => {
    const result = {} as Record<TaskActionKey, boolean>;
    for (const taskType of AI_TASK_TYPES) {
      for (const action of TASK_ACTIONS) {
        result[`${taskType}:${action}`] = busyAction === `${taskType}:${action}`;
      }
    }
    return result;
  }, [busyAction]);

  return { status, loading, busy, start, pause, retryFailed, clearQueue, requeueAll, refresh };
}
