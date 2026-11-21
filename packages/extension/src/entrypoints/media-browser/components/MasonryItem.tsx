/**
 * MasonryItem Component
 *
 * Renders a single media item in the Masonry grid.
 */

import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CombinedMediaItem } from '../hooks/useCombinedMedia';
import { getPrimaryTag } from '../../../shared/tag-utils';
import { buildVfsThumbnailUrl } from '../utils/media';
import styles from './MasonryItem.module.css';

const GRID_THUMBNAIL_SIZE = 'large';

interface MasonryItemProps {
  item?: CombinedMediaItem;
  onClick?: () => void;
  onDelete?: (hash: string) => void;
  onDeleteRequest?: (hash: string) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (hash: string) => void;
}

/**
 * MasonryItem main component
 */
const MasonryItem = memo(function MasonryItem({
  item,
  onClick,
  onDelete,
  onDeleteRequest,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: MasonryItemProps) {
  const { t } = useTranslation();
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const itemHash = item?.hash;

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [itemHash]);

  // Cached thumbnails can finish loading before React attaches `onLoad`
  // (especially after a remount). Pick that state up directly from the element
  // so cached images never get stranded on the "loading" placeholder.
  useEffect(() => {
    const img = imageRef.current;
    if (!img?.complete) return;
    if (img.naturalWidth > 0) {
      setImageLoaded(true);
    } else {
      setImageError(true);
    }
  }, [itemHash]);

  if (!item?.hash || !item.mimeType) {
    console.warn('[MasonryItem] Invalid media item:', item);
    return null;
  }

  const thumbnailSrc = buildVfsThumbnailUrl(item.hash, GRID_THUMBNAIL_SIZE);
  const isVideo = item.mimeType.startsWith('video/');
  const primaryTag = getPrimaryTag(item.tags);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteRequest) {
      onDeleteRequest(item.hash);
      return;
    }
    if (onDelete && window.confirm(t('delete.confirm'))) {
      onDelete(item.hash);
    }
  };

  const handleActivate = () => {
    if (selectionMode) {
      onToggleSelect?.(item.hash);
      return;
    }
    onClick?.();
  };

  return (
    <div
      className={styles.item}
      role="button"
      tabIndex={0}
      aria-label={selectionMode ? '选择媒体' : '打开媒体'}
      aria-pressed={selectionMode ? selected : undefined}
      style={selected ? { outline: '3px solid #1677ff', outlineOffset: -3 } : undefined}
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleActivate();
        }
      }}
    >
      <div className={styles.thumbnailWrapper}>
        {!imageLoaded && !imageError && <div className={styles.placeholder}>加载中...</div>}
        {imageError && (
          <div className={styles.placeholder}>
            {isVideo ? <span className={styles.videoIcon}>🎬</span> : '加载失败'}
          </div>
        )}
        {/* The grid is virtualized, so only visible items are mounted — lazy
            loading just strands thumbnails that mount in a zero-width pane. */}
        {!imageError && (
          <img
            ref={imageRef}
            src={thumbnailSrc}
            alt=""
            className={`${styles.thumbnail} ${imageLoaded ? styles.loaded : ''}`}
            decoding="async"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}
        {selectionMode && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              width: 22,
              height: 22,
              borderRadius: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: selected ? '#1677ff' : 'rgba(255,255,255,0.9)',
              color: selected ? '#fff' : '#555',
              border: '1px solid #1677ff',
              fontSize: 14,
            }}
          >
            {selected ? '✓' : ''}
          </span>
        )}
        {item.isStarred && (
          <span title="已收藏" style={{ position: 'absolute', top: 6, right: 32, fontSize: 14 }}>
            ⭐
          </span>
        )}
        {primaryTag && <span className={styles.tagBadge}>#{primaryTag}</span>}
        {!selectionMode && (onDelete || onDeleteRequest) && (
          <button
            type="button"
            className={styles.deleteButton}
            onClick={handleDelete}
            aria-label={t('delete.button', '删除')}
            title={t('delete.title', '删除')}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
});

export default MasonryItem;
