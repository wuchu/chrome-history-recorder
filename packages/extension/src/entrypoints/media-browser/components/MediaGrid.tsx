/**
 * MediaGrid Component
 *
 * Displays captured media in a grid layout with thumbnails.
 */

import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { buildVfsThumbnailUrl } from '../utils/media';
import styles from './MediaGrid.module.css';

interface MediaItemData {
  hash: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl: string;
  capturedAt: string;
  category?: string;
  confidence?: number;
  tags?: string[];
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}

interface MediaGridProps {
  items: MediaItemData[];
  onItemClick?: (item: MediaItemData) => void;
  onClear?: () => void;
  activeTab?: 'images' | 'videos';
}

/**
 * Status badge component
 */
const StatusBadge = memo(function StatusBadge({
  status,
}: {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}) {
  if (!status) return null;

  const config = {
    pending: { icon: '○', text: '等待', class: styles.pending },
    processing: { icon: '◉', text: '分类中', class: styles.processing },
    completed: { icon: '✓', text: '已完成', class: styles.completed },
    failed: { icon: '✗', text: '失败', class: styles.failed },
  };

  const { icon, text, class: cls } = config[status];

  return (
    <span className={`${styles.statusBadge} ${cls}`}>
      {icon} {text}
    </span>
  );
});

/**
 * Confidence bar component
 */
const ConfidenceBar = memo(function ConfidenceBar({ confidence }: { confidence?: number }) {
  if (!confidence) return null;

  const percentage = Math.round(confidence * 100);

  return (
    <div className={styles.confidenceContainer}>
      <div className={styles.confidenceBar}>
        <div className={styles.confidenceFill} style={{ width: `${percentage}%` }} />
      </div>
      <span className={styles.confidenceText}>{percentage}%</span>
    </div>
  );
});

/**
 * Single media grid item
 */
const GridItem = memo(function GridItem({
  item,
  onClick,
}: {
  item: MediaItemData;
  onClick: () => void;
}) {
  const thumbnailSrc = item.thumbnailUrl || buildVfsThumbnailUrl(item.hash);

  return (
    <div className={styles.gridItem} onClick={onClick}>
      <div className={styles.thumbnailWrapper}>
        <img src={thumbnailSrc} alt={item.filename} className={styles.thumbnail} loading="lazy" />
        <StatusBadge status={item.status} />
      </div>

      <div className={styles.itemInfo}>
        {item.category && <div className={styles.category}>{item.category}</div>}
        <ConfidenceBar confidence={item.confidence} />
        {item.tags && item.tags.length > 0 && (
          <div className={styles.tags}>
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className={styles.timestamp}>{new Date(item.capturedAt).toLocaleString()}</div>
      </div>
    </div>
  );
});

/**
 * MediaGrid main component
 */
const MediaGrid = memo(function MediaGrid({ items, onItemClick, onClear }: MediaGridProps) {
  const { t } = useTranslation();

  const handleItemClick = useCallback(
    (item: MediaItemData) => {
      if (onItemClick) {
        onItemClick(item);
      }
    },
    [onItemClick]
  );

  const handleClear = useCallback(() => {
    if (onClear) {
      onClear();
    }
  }, [onClear]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.count}>{t('mediaGrid.count', { count: items.length })}</span>
        {items.length > 0 && onClear && (
          <button className={styles.clearButton} onClick={handleClear}>
            {t('mediaGrid.clear', '清空')}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <p>{t('mediaGrid.empty', '暂无媒体')}</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {items.map((item) => (
            <GridItem key={item.hash} item={item} onClick={() => handleItemClick(item)} />
          ))}
        </div>
      )}
    </div>
  );
});

export default MediaGrid;
