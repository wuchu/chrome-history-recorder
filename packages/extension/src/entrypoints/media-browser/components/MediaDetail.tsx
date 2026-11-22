/**
 * MediaDetail Component
 *
 * Image viewer for captured media items.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildVfsDownloadUrl, buildVfsFileUrl } from '../utils/media';
import styles from './MediaDetail.module.css';

interface MediaDetailData {
  hash: string;
  filename?: string;
  mimeType: string;
  size: number;
  url?: string;
  sourceUrl?: string;
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
  deletedAt?: string;
  isStarred?: boolean;
}

interface MediaDetailProps {
  item: MediaDetailData | null;
  onClose: () => void;
  onDelete?: (hash: string) => void;
  onDeleteRequest?: (hash: string) => void;
  /** Requeue one AI task type for this file (single-file refresh). */
  onRefreshTask?: (taskType: 'classify' | 'rename', hash: string) => void;
  /** `trash` swaps management actions for restore / permanent delete. */
  mode?: 'library' | 'trash';
  onRestore?: (hash: string) => void;
  onPurgeRequest?: (hash: string) => void;
  onToggleStar?: (hash: string, starred: boolean) => void;
  onDownload?: (item: MediaDetailData) => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function normalizeTagList(tags: string | string[] | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * MediaDetail modal component
 */
const MediaDetail = memo(function MediaDetail({
  item,
  onClose,
  onDelete,
  onDeleteRequest,
  onRefreshTask,
  mode = 'library',
  onRestore,
  onPurgeRequest,
  onToggleStar,
  onDownload,
  onNavigate,
  hasPrev = false,
  hasNext = false,
}: MediaDetailProps) {
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
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowLeft' && hasPrev) {
        onNavigate?.('prev');
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNavigate?.('next');
      }
    };

    if (item) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [item, onClose, onNavigate, hasPrev, hasNext]);

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setVideoError(false);
  }, [item?.hash]);

  if (!item) return null;

  const handleDelete = () => {
    if (mode === 'trash' && onPurgeRequest) {
      onPurgeRequest(item.hash);
      return;
    }
    if (onDeleteRequest) {
      onDeleteRequest(item.hash);
      return;
    }
    if (window.confirm(t('delete.confirm'))) {
      onDelete?.(item.hash);
      onClose();
    }
  };

  const imageUrl = buildVfsFileUrl(item.hash);
  const filename = item.ai_filename || item.hash;
  const isImage = item.mimeType.startsWith('image/');
  const tags = normalizeTagList(item.tags);

  const handleDownload = () => {
    if (onDownload) {
      onDownload(item);
      return;
    }
    void chrome.downloads.download({ url: buildVfsDownloadUrl(item.hash), saveAs: true });
  };

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

        <div className={styles.metadata}>
          <div className={styles.metadataTitle}>{t('mediaDetail.fileInfo', '文件信息')}</div>
          <div className={styles.metadataRow}>
            <span>{t('mediaDetail.type', '类型')}</span>
            <span>{item.mimeType}</span>
          </div>
          <div className={styles.metadataRow}>
            <span>{t('mediaDetail.size', '大小')}</span>
            <span>{formatSize(item.size)}</span>
          </div>
          <div className={styles.metadataRow}>
            <span>{t('mediaDetail.capturedAt', '捕获时间')}</span>
            <span>{item.capturedAt ? new Date(item.capturedAt).toLocaleString() : '-'}</span>
          </div>
          <div className={styles.metadataRow}>
            <span>{t('mediaDetail.hash', 'Hash')}</span>
            <span className={styles.metadataMono}>{item.hash}</span>
          </div>
          {item.deletedAt && (
            <div className={styles.metadataRow}>
              <span>{t('mediaDetail.deletedAt', '删除时间')}</span>
              <span>{new Date(item.deletedAt).toLocaleString()}</span>
            </div>
          )}
          {item.sourceUrl && (
            <div className={styles.metadataRow}>
              <span>{t('mediaDetail.source', '来源')}</span>
              <a
                className={styles.metadataLink}
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                title={item.sourceUrl}
              >
                {item.sourceUrl}
              </a>
            </div>
          )}
          {tags.length > 0 && (
            <div className={styles.metadataRow}>
              <span>{t('mediaDetail.tags', '标签')}</span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tags.map((tag) => (
                  <span key={tag}>#{tag.replace(/^system:/, '')}</span>
                ))}
              </span>
            </div>
          )}
          {item.model_used && (
            <div className={styles.metadataRow}>
              <span>{t('mediaDetail.modelUsed', '模型')}</span>
              <span>{item.model_used}</span>
            </div>
          )}
          {typeof item.confidence === 'number' && item.confidence > 0 && (
            <div className={styles.metadataRow}>
              <span>{t('mediaDetail.confidence', '置信度')}</span>
              <span>{Math.round(item.confidence * 100)}%</span>
            </div>
          )}
        </div>

        <div className={styles.toolbar}>
          {onNavigate && (
            <>
              <button
                type="button"
                className={styles.refreshButton}
                title={t('mediaDetail.previous', '上一张')}
                disabled={!hasPrev}
                onClick={() => onNavigate('prev')}
              >
                ‹
              </button>
              <button
                type="button"
                className={styles.refreshButton}
                title={t('mediaDetail.next', '下一张')}
                disabled={!hasNext}
                onClick={() => onNavigate('next')}
              >
                ›
              </button>
            </>
          )}
          {onToggleStar && (
            <button
              type="button"
              className={styles.refreshButton}
              title={item.isStarred ? '取消收藏' : '收藏'}
              onClick={() => onToggleStar(item.hash, !item.isStarred)}
            >
              {item.isStarred ? '⭐' : '☆'}
            </button>
          )}
          {onDownload && (
            <button
              type="button"
              className={styles.refreshButton}
              title={t('mediaDetail.download', '下载原图')}
              onClick={handleDownload}
            >
              ⬇️
            </button>
          )}
          {mode !== 'trash' && onRefreshTask && (
            <>
              <button
                type="button"
                className={styles.refreshButton}
                title="重新分类"
                onClick={() => onRefreshTask('classify', item.hash)}
              >
                🏷️
              </button>
              <button
                type="button"
                className={styles.refreshButton}
                title="重新命名"
                onClick={() => onRefreshTask('rename', item.hash)}
              >
                ✏️
              </button>
            </>
          )}
          {mode === 'trash' && onRestore && (
            <button
              type="button"
              className={styles.refreshButton}
              title={t('trash.restore', '恢复')}
              onClick={() => onRestore(item.hash)}
            >
              ♻️
            </button>
          )}
          {(onDelete || onDeleteRequest || (mode === 'trash' && onPurgeRequest)) && (
            <button
              type="button"
              className={styles.deleteButton}
              title={mode === 'trash' ? t('trash.purge', '永久删除') : t('delete.title')}
              onClick={handleDelete}
            >
              🗑️
            </button>
          )}
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
