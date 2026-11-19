/**
 * ClassifyProgressSection Component
 *
 * Displays AI task queue progress (classify / rename) and statistics.
 */

import { memo, useCallback, useState, useMemo } from 'react';
import { Progress, Button, Tooltip, ConfigProvider, theme } from 'antd';
import {
  RobotOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  DeleteOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ClassifyQueueStatus } from '../hooks/useClassifyQueue';
import { useTheme } from '../hooks';
import styles from './ClassifyProgressSection.module.css';

interface ClassifyProgressSectionProps {
  status: ClassifyQueueStatus;
  loading?: boolean;
  onStart?: () => Promise<void>;
  onPause?: () => Promise<void>;
  onRetryFailed?: () => Promise<void>;
  onClearQueue?: () => Promise<void>;
  onRefreshAll?: () => Promise<void>;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  classify: 'AI 分类',
  rename: 'AI 重命名',
};

interface TypeRow {
  key: string;
  label: string;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

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
  onRefreshAll,
}: ClassifyProgressSectionProps) {
  const { t: _t } = useTranslation();
  const { themeMode, systemDark } = useTheme();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const schedulerRunning = status.scheduler?.running ?? false;

  // Per-task-type rows; fall back to the aggregated counters when VFS
  // does not report a breakdown.
  const typeRows = useMemo((): TypeRow[] => {
    const byType = status.byType;
    if (!byType || Object.keys(byType).length === 0) {
      return [
        {
          key: 'all',
          label: TASK_TYPE_LABELS.classify,
          pending: status.pending,
          processing: status.processing,
          completed: status.completed,
          failed: status.failed,
          total: status.total,
        },
      ];
    }

    const preferred = ['classify', 'rename'];
    const keys = [
      ...preferred.filter((key) => byType[key] !== undefined),
      ...Object.keys(byType).filter((key) => !preferred.includes(key)),
    ];

    return keys.map((key) => ({
      key,
      label: TASK_TYPE_LABELS[key] ?? key,
      ...byType[key],
    }));
  }, [status]);

  // Determine if dark mode
  const isDark = useMemo(() => {
    if (themeMode === 'auto') return systemDark;
    return themeMode === 'dark';
  }, [themeMode, systemDark]);

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
    if (!window.confirm('确定要清空任务队列吗？')) return;
    await runAction('clear', onClearQueue);
  }, [onClearQueue, runAction]);

  const handleRefreshAll = useCallback(async () => {
    if (!onRefreshAll) return;
    if (!window.confirm('确定要重新扫描全部媒体的分类与命名吗？')) return;
    await runAction('refresh', onRefreshAll);
  }, [onRefreshAll, runAction]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>加载任务状态...</div>
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 4,
        },
      }}
    >
      <div className={styles.container}>
        <div className={styles.leftSection}>
          <RobotOutlined className={styles.robotIcon} />
          <div className={styles.typeList}>
            {typeRows.map((row) => {
              const percent = row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
              const progressStatus =
                row.failed > 0 ? 'exception' : schedulerRunning ? 'active' : 'normal';
              return (
                <div key={row.key} className={styles.typeRow}>
                  <span className={styles.label}>{row.label}</span>
                  <div className={styles.progressWrapper}>
                    <Progress
                      percent={percent}
                      size="small"
                      status={progressStatus}
                      showInfo={true}
                      strokeColor={
                        row.failed > 0 ? undefined : schedulerRunning ? '#52c41a' : '#faad14'
                      }
                    />
                  </div>
                  <span
                    className={styles.counts}
                    title={`待处理 ${row.pending} · 处理中 ${row.processing} · 已完成 ${row.completed} · 失败 ${row.failed}`}
                  >
                    {row.pending > 0 ? `${row.pending} 待处理` : `${row.completed}/${row.total}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.rightSection}>
          {schedulerRunning ? (
            <Tooltip title="暂停任务">
              <Button
                type="text"
                size="small"
                icon={<PauseCircleOutlined />}
                disabled={busyAction === 'pause'}
                onClick={() => runAction('pause', onPause)}
              />
            </Tooltip>
          ) : (
            <Tooltip title="开始任务">
              <Button
                type="text"
                size="small"
                icon={<PlayCircleOutlined />}
                disabled={busyAction === 'start'}
                onClick={() => runAction('start', onStart)}
              />
            </Tooltip>
          )}

          {onRefreshAll && (
            <Tooltip title="全量重扫（分类 + 重命名）">
              <Button
                type="text"
                size="small"
                icon={<SyncOutlined />}
                disabled={busyAction === 'refresh'}
                onClick={handleRefreshAll}
              />
            </Tooltip>
          )}

          {status.failed > 0 && (
            <Tooltip title="重试失败任务">
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                disabled={busyAction === 'retry'}
                onClick={() => runAction('retry', onRetryFailed)}
              />
            </Tooltip>
          )}

          {status.total > 0 && (
            <Tooltip title="清空队列">
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                disabled={busyAction === 'clear'}
                onClick={handleClearQueue}
              />
            </Tooltip>
          )}
        </div>
      </div>
    </ConfigProvider>
  );
});

export default ClassifyProgressSection;
