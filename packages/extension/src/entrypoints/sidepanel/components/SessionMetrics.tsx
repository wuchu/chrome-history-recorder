import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionCounters } from '../../../shared/extension-runtime';
import { formatBytes, formatDuration } from '../utils';
import styles from '../cockpit.module.css';

interface SessionMetricsProps {
  counters: SessionCounters;
  startedAt: string;
  endedAt?: string;
  status: 'capturing' | 'stopped' | 'error';
}

export function SessionMetrics({ counters, startedAt, endedAt, status }: SessionMetricsProps) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endedAt || status !== 'capturing') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [endedAt, status]);

  const endTime = endedAt ? new Date(endedAt).getTime() : now;
  const duration = Math.max(0, endTime - new Date(startedAt).getTime());

  const metrics: Array<{
    key: string;
    label: string;
    value: number;
    tone?: 'success' | 'warning' | 'danger';
  }> = [
    {
      key: 'saved',
      label: t('cockpit.metrics.saved', '保存'),
      value: counters.saved,
      tone: 'success',
    },
    { key: 'duplicate', label: t('cockpit.metrics.duplicate', '重复'), value: counters.duplicate },
    {
      key: 'skipped',
      label: t('cockpit.metrics.skipped', '跳过'),
      value: counters.skipped,
      tone: 'warning',
    },
    {
      key: 'failed',
      label: t('cockpit.metrics.failed', '失败'),
      value: counters.failed,
      tone: 'danger',
    },
  ];

  return (
    <div className={styles.metrics}>
      <div className={styles.metricPrimary}>
        <div className={styles.metricMainValue}>{formatBytes(counters.bytesSaved)}</div>
        <div className={styles.metricMainLabel}>
          {t('cockpit.metrics.totalSize', '本次会话保存大小')}
        </div>
      </div>
      <div className={styles.metricGrid}>
        {metrics.map((metric) => (
          <div key={metric.key} className={styles.metric}>
            <span className={`${styles.metricValue} ${metric.tone ? styles[metric.tone] : ''}`}>
              {metric.value}
            </span>
            <span className={styles.metricLabel}>{metric.label}</span>
          </div>
        ))}
      </div>
      <div className={styles.metricFooter}>
        <span>
          {t('cockpit.metrics.media', '媒体')} {counters.imagesSaved} 图 · {counters.videosSaved}{' '}
          视频
        </span>
        <span>
          {t('cockpit.metrics.ai', 'AI')} {counters.aiPending} 排队 · {counters.aiProcessing} 处理中
          · {counters.aiCompleted} 完成
        </span>
        {counters.videosQueued + counters.videosDownloading > 0 && (
          <span>
            {t('cockpit.metrics.videoQueue', '视频')} {counters.videosQueued} 排队 ·{' '}
            {counters.videosDownloading} 下载中
          </span>
        )}
        <span className={styles.metricDuration}>
          {status === 'capturing'
            ? t('cockpit.metrics.running', {
                duration: formatDuration(duration),
                defaultValue: '运行 {{duration}}',
              })
            : t('cockpit.metrics.duration', {
                duration: formatDuration(duration),
                defaultValue: '用时 {{duration}}',
              })}
        </span>
      </div>
    </div>
  );
}

export default SessionMetrics;
