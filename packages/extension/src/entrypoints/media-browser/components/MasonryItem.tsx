/**
 * MasonryItem Component
 *
 * Renders a single media item in the Masonry grid.
 */

import { memo, useEffect, useState } from 'react';
import type { CombinedMediaItem } from '../hooks/useCombinedMedia';
import { buildVfsThumbnailUrl } from '../utils/media';
import styles from './MasonryItem.module.css';

const GRID_THUMBNAIL_SIZE = 'large';

interface MasonryItemProps {
  item?: CombinedMediaItem;
  onClick?: () => void;
}

/**
 * MasonryItem main component
 */
const MasonryItem = memo(function MasonryItem({ item, onClick }: MasonryItemProps) {
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

  const thumbnailSrc = buildVfsThumbnailUrl(item.hash, GRID_THUMBNAIL_SIZE);
  const isVideo = item.mimeType.startsWith('video/');

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <button type="button" className={styles.item} onClick={onClick} aria-label="打开媒体">
      <div className={styles.thumbnailWrapper}>
        {!imageLoaded && !imageError && <div className={styles.placeholder}>加载中...</div>}
        {imageError && (
          <div className={styles.placeholder}>
            {isVideo ? <span className={styles.videoIcon}>🎬</span> : '加载失败'}
          </div>
        )}
        {!imageError && (
          <img
            src={thumbnailSrc}
            alt=""
            className={`${styles.thumbnail} ${imageLoaded ? styles.loaded : ''}`}
            loading="lazy"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}
      </div>
    </button>
  );
});

export default MasonryItem;
