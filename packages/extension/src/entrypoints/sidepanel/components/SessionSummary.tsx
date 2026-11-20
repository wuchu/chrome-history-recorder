import { useTranslation } from 'react-i18next';
import type { SessionSummary as SessionSummaryType } from '../../../shared/extension-runtime';
import { formatBytes, formatDuration } from '../utils';
import styles from '../cockpit.module.css';

interface SessionSummaryProps {
  summary: SessionSummaryType;
  busy?: boolean;
  onRestart: () => void;
  onOpenLibrary: () => void;
}

export function SessionSummary({ summary, busy, onRestart, onOpenLibrary }: SessionSummaryProps) {
  const { t } = useTranslation();
  const counters = summary.counters;

  return (
    <section className={styles.summary}>
      <div className={styles.summaryHeader}>
        <div>
          <div className={styles.summaryTitle}>{t('cockpit.summary.title', '本次会话已结束')}</div>
          <div className={styles.summarySubtitle}>{summary.tabTitle || summary.pageUrl}</div>
        </div>
        <div className={styles.summaryDuration}>{formatDuration(summary.durationMs)}</div>
      </div>

      {summary.error && <div className={styles.errorBox}>{summary.error}</div>}

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCell}>
          <span className={styles.summaryValue}>{counters.saved}</span>
          <span className={styles.summaryLabel}>{t('cockpit.metrics.saved', '保存')}</span>
        </div>
        <div className={styles.summaryCell}>
          <span className={styles.summaryValue}>{counters.duplicate}</span>
          <span className={styles.summaryLabel}>{t('cockpit.metrics.duplicate', '重复')}</span>
        </div>
        <div className={styles.summaryCell}>
          <span className={`${styles.summaryValue} ${styles.warning}`}>{counters.skipped}</span>
          <span className={styles.summaryLabel}>{t('cockpit.metrics.skipped', '跳过')}</span>
        </div>
        <div className={styles.summaryCell}>
          <span className={`${styles.summaryValue} ${styles.danger}`}>{counters.failed}</span>
          <span className={styles.summaryLabel}>{t('cockpit.metrics.failed', '失败')}</span>
        </div>
        <div className={styles.summaryCell}>
          <span className={styles.summaryValue}>{formatBytes(counters.bytesSaved)}</span>
          <span className={styles.summaryLabel}>{t('cockpit.summary.size', '保存大小')}</span>
        </div>
        <div className={styles.summaryCell}>
          <span className={styles.summaryValue}>
            {counters.imagesSaved} / {counters.videosSaved}
          </span>
          <span className={styles.summaryLabel}>{t('cockpit.summary.media', '图片 / 视频')}</span>
        </div>
      </div>

      {summary.topReasons.length > 0 && (
        <div className={styles.summaryReasons}>
          <div className={styles.summaryReasonsTitle}>
            {t('cockpit.summary.topReasons', '主要跳过 / 失败原因')}
          </div>
          {summary.topReasons.map((reason) => (
            <div key={reason.reason} className={styles.summaryReason}>
              <span>{reason.reason}</span>
              <span className={styles.summaryReasonCount}>{reason.count}</span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.summaryActions}>
        <button type="button" className={styles.primaryButton} onClick={onRestart} disabled={busy}>
          {t('cockpit.summary.restart', '重新开始捕获')}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onOpenLibrary}>
          {t('cockpit.openLibrary', '打开媒体库')}
        </button>
      </div>
    </section>
  );
}

export default SessionSummary;
