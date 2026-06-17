/**
 * ClassifyProgressSection Component
 *
 * Displays classification queue progress and statistics.
 */

import { memo, useCallback, useState, useMemo } from 'react';
import { Progress, Button, Tooltip, ConfigProvider, theme } from 'antd';
import {
  RobotOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  DeleteOutlined,
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
}: ClassifyProgressSectionProps) {
  const { t: _t } = useTranslation();
  const { themeMode, systemDark } = useTheme();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const schedulerRunning = status.scheduler?.running ?? false;

  // Calculate progress percentage
  const percent = status.total > 0 ? Math.round((status.completed / status.total) * 100) : 0;

  // Determine progress status and color
  const getProgressStatus = () => {
    if (status.failed > 0) return 'exception';
    if (schedulerRunning) return 'active';
    return 'normal';
  };

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
          <span className={styles.label}>AI 分类</span>
          <div className={styles.progressWrapper}>
            <Progress
              percent={percent}
              size="small"
              status={getProgressStatus()}
              showInfo={true}
              strokeColor={status.failed > 0 ? undefined : schedulerRunning ? '#52c41a' : '#faad14'}
            />
          </div>
        </div>

        <div className={styles.rightSection}>
          {schedulerRunning ? (
            <Tooltip title="暂停分类">
              <Button
                type="text"
                size="small"
                icon={<PauseCircleOutlined />}
                disabled={busyAction === 'pause'}
                onClick={() => runAction('pause', onPause)}
              />
            </Tooltip>
          ) : (
            <Tooltip title="开始分类">
              <Button
                type="text"
                size="small"
                icon={<PlayCircleOutlined />}
                disabled={busyAction === 'start'}
                onClick={() => runAction('start', onStart)}
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
