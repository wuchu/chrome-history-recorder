/**
 * MasonryItem Component
 *
 * Renders a single media item in the Masonry grid.
 */

import { memo, useEffect, useState } from 'react';
import type { CombinedMediaItem } from '../hooks/useCombinedMedia';
import styles from './MasonryItem.module.css';

/**
 * VFS HTTP Server base URL for thumbnail access
 */
const VFS_HTTP_BASE_URL = 'http://localhost:8766';

interface MasonryItemProps {
  item?: CombinedMediaItem;
  onClick?: () => void;
  onRequeue?: (hash: string) => Promise<void>;
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
    pending: { icon: '⏳', text: '等待', class: styles.pending },
    processing: { icon: '🔄', text: '分类中', class: styles.processing },
    completed: { icon: '✅', text: '已完成', class: styles.completed },
    failed: { icon: '❌', text: '失败', class: styles.failed },
  };

  const { icon, class: cls } = config[status];

  return (
    <span className={`${styles.statusBadge} ${cls}`}>
      {icon}
    </span>
  );
});

/**
 * Confidence bar component
 */
const ConfidenceBar = memo(function ConfidenceBar({
  confidence,
}: {
  confidence?: number;
}) {
  if (!confidence) return null;

  const percentage = Math.round(confidence * 100);

  return (
    <div className={styles.confidenceContainer}>
      <div className={styles.confidenceBar}>
        <div
          className={styles.confidenceFill}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={styles.confidenceText}>{percentage}%</span>
    </div>
  );
});

/**
 * MasonryItem main component
 */
const MasonryItem = memo(function MasonryItem({
  item,
  onClick,
  onRequeue,
}: MasonryItemProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const itemHash = item?.hash;

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [itemHash]);

  if (!item?.hash || !item.mimeType) {
    console.warn('[MasonryItem] Invalid media item:', item);
    return null;
  }

  // Use normalized thumbnail URL when available, fallback to VFS HTTP Server URL.
  const thumbnailSrc = item.thumbnailUrl || `${VFS_HTTP_BASE_URL}/files/${item.hash}/thumbnail?size=medium`;
  const isImage = item.mimeType.startsWith('image/');

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const handleRequeueClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (item.hash) {
      onRequeue?.(item.hash);
    }
  };

  return (
    <div className={styles.item} onClick={onClick}>
      <div className={styles.thumbnailWrapper}>
        {isImage ? (
          <>
            {!imageLoaded && !imageError && (
              <div className={styles.placeholder}>加载中...</div>
            )}
            {imageError && (
              <div className={styles.placeholder}>加载失败</div>
            )}
            <img
              src={thumbnailSrc}
              alt={item.ai_filename || item.hash}
              className={`${styles.thumbnail} ${imageLoaded ? styles.loaded : ''}`}
              loading="lazy"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </>
        ) : (
          <div className={styles.videoIcon}>
            <span>🎬</span>
          </div>
        )}
        <StatusBadge status={item.classifyStatus} />
        {onRequeue && (
          <button
            type="button"
            className={styles.quickAction}
            title="重新分类/重命名"
            onClick={handleRequeueClick}
          >
            ⟳
          </button>
        )}
      </div>

      <div className={styles.itemInfo}>
        {item.category && (
          <div className={styles.category}>分类: {item.category}</div>
        )}
        {item.ai_filename && (
          <div className={styles.aiFilename} title={item.ai_filename}>文件名: {item.ai_filename}</div>
        )}
        <ConfidenceBar confidence={item.confidence} />
        {item.tags && item.tags.length > 0 && (
          <div className={styles.tags}>
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default MasonryItem;