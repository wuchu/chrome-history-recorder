import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './StatsSection.module.css';

interface ImageStats {
  captured: number;
  skipped: number;
  failed: number;
  size: number;
}

interface VideoStats {
  captured: number;
  skipped: number;
  failed: number;
  size: number;
}

interface StatsSectionProps {
  imageStats: ImageStats;
  videoStats: VideoStats;
  formatSize: (bytes: number) => string;
}

/**
 * 统计面板组件
 * 规则: rerender-memo - 使用 memo 避免不必要的重渲染
 */
const StatsSection = memo(function StatsSection({
  imageStats,
  videoStats,
  formatSize,
}: StatsSectionProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <div className={styles.statsGroup}>
        <div className={styles.statsTitle}>{t('stats.images')}</div>
        <div className={styles.statItem}>
          <span className={styles.label}>{t('stats.captured')}:</span>
          <span className={styles.value}>{imageStats.captured}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.label}>{t('stats.skipped')}:</span>
          <span className={styles.value}>{imageStats.skipped}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.label}>{t('stats.failed')}:</span>
          <span className={`${styles.value} ${styles.failed}`}>{imageStats.failed}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.label}>{t('stats.size')}:</span>
          <span className={styles.value}>{formatSize(imageStats.size)}</span>
        </div>
      </div>
      <div className={styles.statsGroup}>
        <div className={styles.statsTitle}>{t('stats.videos')}</div>
        <div className={styles.statItem}>
          <span className={styles.label}>{t('stats.captured')}:</span>
          <span className={styles.value}>{videoStats.captured}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.label}>{t('stats.skipped')}:</span>
          <span className={styles.value}>{videoStats.skipped}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.label}>{t('stats.failed')}:</span>
          <span className={`${styles.value} ${styles.failed}`}>{videoStats.failed}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.label}>{t('stats.size')}:</span>
          <span className={styles.value}>{formatSize(videoStats.size)}</span>
        </div>
      </div>
    </div>
  );
});

export default StatsSection;
