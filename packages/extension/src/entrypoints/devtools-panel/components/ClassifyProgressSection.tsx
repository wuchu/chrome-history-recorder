/**
 * ClassifyProgressSection Component
 *
 * Displays classification queue progress and statistics.
 */

import { memo, useCallback, useState } from 'react';
import type { ClassifyQueueStatus } from '../hooks/useClassifyQueue';
import styles from './ClassifyProgressSection.module.css';

interface ClassifyProgressSectionProps {
  status: ClassifyQueueStatus;
  loading?: boolean;
  onStart?: () => Promise<void>;
  onPause?: () => Promise<void>;
  onRetryFailed?: () => Promise<void>;
  onClearQueue?: () => Promise<void>;
}

const QueueStat = memo(function QueueStat({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <span className={`${styles.queueStat} ${colorClass}`}>
      {label} <strong>{value}</strong>
    </span>
  );
});

/**
 * ClassifyProgressSection main component
 */
const ClassifyProgressSection = memo(function ClassifyProgressSection({
  status,
  loading,
  onStart,
  onPause,
  onRetryFailed,
  onClearQueue,
}: ClassifyProgressSectionProps) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const schedulerRunning = status.scheduler?.running ?? false;

  const runAction = useCallback(async (name: string, action?: () => Promise<void>) => {
    if (!action) return;
    setBusyAction(name);
    try {
      await action();
    } finally {
      setBusyAction(null);
    }
  }, []);

  const handleClearQueue = useCallback(async () => {
    if (!onClearQueue) return;
    if (!window.confirm('确定要清空分类队列吗？')) return;
    await runAction('clear', onClearQueue);
  }, [onClearQueue, runAction]);
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>加载分类状态...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.summary}>
        <span className={styles.title}>🤖 AI 分类</span>
        <span className={schedulerRunning ? styles.runningState : styles.pausedState}>
          {schedulerRunning ? '运行中' : '已暂停'}
        </span>
        <div className={styles.queueStats}>
          <QueueStat label="等待" value={status.pending} colorClass={styles.pending} />
          <QueueStat label="处理中" value={status.processing} colorClass={styles.processing} />
          <QueueStat label="完成" value={status.completed} colorClass={styles.completed} />
          <QueueStat label="失败" value={status.failed} colorClass={styles.failed} />
        </div>
      </div>

      <div className={styles.controls}>
        {schedulerRunning ? (
          <button
            className={styles.controlButton}
            disabled={busyAction === 'pause'}
            onClick={() => runAction('pause', onPause)}
          >
            暂停
          </button>
        ) : (
          <button
            className={styles.controlButton}
            disabled={busyAction === 'start'}
            onClick={() => runAction('start', onStart)}
          >
            开始
          </button>
        )}
        <button
          className={styles.controlButton}
          disabled={status.failed === 0 || busyAction === 'retry'}
          onClick={() => runAction('retry', onRetryFailed)}
        >
          重试失败
        </button>
        <button
          className={styles.dangerButton}
          disabled={status.total === 0 || busyAction === 'clear'}
          onClick={handleClearQueue}
        >
          清空队列
        </button>
      </div>
    </div>
  );
});

export default ClassifyProgressSection;