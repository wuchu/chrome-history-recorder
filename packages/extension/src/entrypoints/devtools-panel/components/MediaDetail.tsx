/**
 * MediaDetail Component
 *
 * Modal panel showing detailed information about a captured media item.
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
  onRequeue?: (hash: string) => Promise<void>;
}

/**
 * Format file size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

/**
 * MediaDetail modal component
 */
const MediaDetail = memo(function MediaDetail({
  item,
  onClose,
  onRequeue,
}: MediaDetailProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const [requeueing, setRequeueing] = useState(false);

  // Handle click outside to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === modalRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  const handleRequeue = useCallback(async () => {
    if (!item?.hash || !onRequeue) return;
    setRequeueing(true);
    try {
      await onRequeue(item.hash);
    } finally {
      setRequeueing(false);
    }
  }, [item?.hash, onRequeue]);

  // Handle escape key to close
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

  if (!item) return null;

  const imageUrl = item.url || buildVfsFileUrl(item.hash);
  const filename = item.filename || item.ai_filename || item.hash;
  const isImage = item.mimeType.startsWith('image/');

  // Parse tags
  const tags = Array.isArray(item.tags) ? item.tags : (item.tags ? JSON.parse(item.tags) : []);
  const hasTags = tags.length > 0;

  return (
    <div
      ref={modalRef}
      className={styles.modal}
      onClick={handleBackdropClick}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>{item.ai_filename || filename}</h3>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.preview}>
          {isImage ? (
            <img
              src={imageUrl}
              alt={filename}
              className={styles.image}
            />
          ) : (
            <div className={styles.videoPlaceholder}>
              <span>🎬</span>
              <p>Video preview unavailable</p>
            </div>
          )}
        </div>

        <div className={styles.info}>
          <div className={styles.infoSection}>
            <h4 className={styles.sectionTitle}>{t('mediaDetail.fileInfo', '文件信息')}</h4>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.label}>{t('mediaDetail.hash', 'Hash')}</span>
                <span className={styles.value}>{item.hash}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.label}>{t('mediaDetail.size', '大小')}</span>
                <span className={styles.value}>{formatSize(item.size)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.label}>{t('mediaDetail.type', '类型')}</span>
                <span className={styles.value}>{item.mimeType}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.label}>{t('mediaDetail.capturedAt', '捕获时间')}</span>
                <span className={styles.value}>
                  {item.capturedAt ? new Date(item.capturedAt).toLocaleString() :
                   item.timestamp ? new Date(item.timestamp).toLocaleString() : '-'}
                </span>
              </div>
            </div>
          </div>

          {(hasTags || item.ai_filename || item.model_used || item.classified_at) && (
            <div className={styles.infoSection}>
              <h4 className={styles.sectionTitle}>{t('mediaDetail.classification', '分类信息')}</h4>
              <div className={styles.infoGrid}>
                {item.ai_filename && (
                  <div className={styles.infoItem}>
                    <span className={styles.label}>{t('mediaDetail.aiFilename', 'AI 文件名')}</span>
                    <span className={styles.value}>{item.ai_filename}</span>
                  </div>
                )}
                {item.model_used && (
                  <div className={styles.infoItem}>
                    <span className={styles.label}>{t('mediaDetail.modelUsed', '模型')}</span>
                    <span className={styles.value}>{item.model_used}</span>
                  </div>
                )}
                {item.classified_at && (
                  <div className={styles.infoItem}>
                    <span className={styles.label}>{t('mediaDetail.classifiedAt', '分类时间')}</span>
                    <span className={styles.value}>{new Date(item.classified_at).toLocaleString()}</span>
                  </div>
                )}
                {item.confidence && (
                  <div className={styles.infoItem}>
                    <span className={styles.label}>{t('mediaDetail.confidence', '置信度')}</span>
                    <span className={styles.value}>{Math.round(item.confidence * 100)}%</span>
                  </div>
                )}
              </div>
              {hasTags && (
                <div className={styles.tagsContainer}>
                  <span className={styles.label}>{t('mediaDetail.tags', '标签')}</span>
                  <div className={styles.tags}>
                    {tags.map((tag) => (
                      <span key={tag} className={styles.tag}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {item.url && (
            <div className={styles.infoSection}>
              <h4 className={styles.sectionTitle}>{t('mediaDetail.source', '来源')}</h4>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.sourceUrl}
              >
                {item.url.length > 50 ? item.url.substring(0, 50) + '...' : item.url}
              </a>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <a
            href={imageUrl}
            download={filename}
            className={styles.actionButton}
          >
            {t('mediaDetail.download', '下载')}
          </a>
          <button
            className={styles.actionButton}
            onClick={() => navigator.clipboard.writeText(filename)}
          >
            {t('mediaDetail.copyFilename', '复制文件名')}
          </button>
          {onRequeue && (
            <button
              className={styles.actionButton}
              onClick={handleRequeue}
              disabled={requeueing}
            >
              {requeueing
                ? t('mediaDetail.requeueing', '加入中...')
                : t('mediaDetail.requeue', '重新分类/重命名')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default MediaDetail;
