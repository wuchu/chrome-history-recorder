/**
 * MediaDetail Component
 *
 * Image viewer for captured media items.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildVfsFileUrl } from '../utils/media';
import styles from './MediaDetail.module.css';

interface MediaDetailData {
  hash: string;
  filename?: string;
  mimeType: string;
  size: number;
  url?: string;
  thumbnailUrl?: string;
  capturedAt?: string;
  date?: string;
  timestamp?: string;
  category?: string;
  ai_filename?: string;
  confidence?: number;
  tags?: string | string[];
  classified_at?: string;
  model_used?: string;
  outputPath?: string;
}

interface MediaDetailProps {
  item: MediaDetailData | null;
  onClose: () => void;
}

/**
 * MediaDetail modal component
 */
const MediaDetail = memo(function MediaDetail({ item, onClose }: MediaDetailProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === modalRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (item) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [item, onClose]);

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setVideoError(false);
  }, [item?.hash]);

  if (!item) return null;

  const imageUrl = buildVfsFileUrl(item.hash);
  const filename = item.ai_filename || item.hash;
  const isImage = item.mimeType.startsWith('image/');

  return (
    <div ref={modalRef} className={styles.modal} onClick={handleBackdropClick}>
      <div className={styles.content}>
        <div className={styles.titleBar} title={filename}>
          {filename}
        </div>

        <div className={styles.viewerStage}>
          {isImage ? (
            <>
              {!imageLoaded && !imageError && (
                <div className={styles.loading}>{t('mediaDetail.loading', '加载中...')}</div>
              )}
              {imageError && (
                <div className={styles.loading}>{t('mediaDetail.loadFailed', '加载失败')}</div>
              )}
              <img
                src={imageUrl}
                alt={filename}
                className={`${styles.image} ${imageLoaded ? styles.loaded : ''}`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            </>
          ) : (
            <>
              {videoError ? (
                <div className={styles.videoPlaceholder}>
                  <p>{t('mediaDetail.videoUnsupported', '该视频格式暂不支持')}</p>
                </div>
              ) : (
                <video
                  src={imageUrl}
                  className={`${styles.video} ${imageLoaded ? styles.loaded : ''}`}
                  controls
                  preload="metadata"
                  playsInline
                  onLoadedData={() => setImageLoaded(true)}
                  onError={() => setVideoError(true)}
                />
              )}
            </>
          )}
        </div>

        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.closeButton}
            title={t('mediaDetail.close', '关闭')}
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
});

export default MediaDetail;
