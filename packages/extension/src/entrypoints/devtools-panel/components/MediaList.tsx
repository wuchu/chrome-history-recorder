import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MediaRequest } from '../../utils/networkListener';
import styles from './MediaList.module.css';

type ActiveTab = 'images' | 'videos';

interface MediaListProps {
  activeTab: ActiveTab;
  images: MediaRequest[];
  videos: MediaRequest[];
  formatSize: (bytes: number) => string;
  truncateUrl: (url: string) => string;
  onClearImages: () => void;
  onClearVideos: () => void;
}

/**
 * 单个媒体项组件
 * 规则: rerender-memo - 使用 memo 避免列表项不必要的重渲染
 */
interface MediaItemProps {
  item: MediaRequest;
  formatSize: (bytes: number) => string;
  truncateUrl: (url: string) => string;
  isVideo?: boolean;
}

const MediaItem = memo(function MediaItem({ item, formatSize, truncateUrl, isVideo }: MediaItemProps) {
  return (
    <div className={`${styles.mediaItem} ${isVideo ? styles.videoItem : ''}`}>
      <div className={styles.mediaInfo}>
        <div className={styles.mediaUrl} title={item.url}>
          {truncateUrl(item.url)}
        </div>
        <div className={styles.mediaMeta}>
          <span>{formatSize(item.size)}</span>
          <span className={styles.separator}>|</span>
          <span>{item.mimeType}</span>
          {item.request?.filename && (
            <>
              <span className={styles.separator}>|</span>
              <span className={styles.filename}>{item.request.filename}</span>
            </>
          )}
        </div>
      </div>
      <div className={`${styles.mediaStatus} ${styles.success}`}>✓</div>
    </div>
  );
});

/**
 * 媒体列表组件
 * 规则: rerender-memo - 使用 memo 避免不必要的重渲染
 * 规则: rendering-conditional-render - 使用三元表达式替代 display: none
 */
const MediaList = memo(function MediaList({
  activeTab,
  images,
  videos,
  formatSize,
  truncateUrl,
  onClearImages,
  onClearVideos
}: MediaListProps) {
  const { t } = useTranslation();

  const handleClearImages = useCallback(() => onClearImages(), [onClearImages]);
  const handleClearVideos = useCallback(() => onClearVideos(), [onClearVideos]);

  return (
    <div className={styles.container}>
      {/* 规则: rendering-conditional-render - 使用三元表达式条件渲染 */}
      {activeTab === 'images' ? (
        <div className={styles.listContainer}>
          <div className={styles.listHeader}>
            <span>{t('mediaList.capturedImages')}</span>
            {images.length > 0 && (
              <button onClick={handleClearImages} className={styles.clearButton}>
                {t('mediaList.clear')}
              </button>
            )}
          </div>
          <div className={styles.list}>
            {images.map((image) => (
              <MediaItem
                key={image.url}
                item={image}
                formatSize={formatSize}
                truncateUrl={truncateUrl}
              />
            ))}
            {images.length === 0 && (
              <div className={styles.noMedia}>
                <p>{t('mediaList.noImages')}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.listContainer}>
          <div className={styles.listHeader}>
            <span>{t('mediaList.capturedVideos')}</span>
            {videos.length > 0 && (
              <button onClick={handleClearVideos} className={styles.clearButton}>
                {t('mediaList.clear')}
              </button>
            )}
          </div>
          <div className={styles.list}>
            {videos.map((video) => (
              <MediaItem
                key={video.url}
                item={video}
                formatSize={formatSize}
                truncateUrl={truncateUrl}
                isVideo
              />
            ))}
            {videos.length === 0 && (
              <div className={styles.noMedia}>
                <p>{t('mediaList.noVideos')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default MediaList;