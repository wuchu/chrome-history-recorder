/**
 * CaptureStream Component
 *
 * Displays the latest captured media in a horizontal stream with thumbnails.
 */

import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { buildVfsThumbnailUrl } from '../utils/media';
import styles from './CaptureStream.module.css';

interface CapturedFile {
  hash: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl: string;
  capturedAt: string;
  classifyStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  classifyData?: {
    category: string;
    confidence: number;
    tags: string[];
  };
}

interface CaptureStreamProps {
  files: CapturedFile[];
  maxItems?: number;
  onItemClick?: (file: CapturedFile) => void;
}

/**
 * Status indicator component
 */
const StatusIndicator = memo(function StatusIndicator({
  status,
}: {
  status: 'pending' | 'processing' | 'completed' | 'failed';
}) {
  const icon = {
    pending: '○',
    processing: '◉',
    completed: '✓',
    failed: '✗',
  };

  const colorClass = {
    pending: styles.pending,
    processing: styles.processing,
    completed: styles.completed,
    failed: styles.failed,
  };

  return <span className={`${styles.statusIcon} ${colorClass[status]}`}>{icon[status]}</span>;
});

/**
 * Single capture item
 */
const CaptureItem = memo(function CaptureItem({
  file,
  onClick,
}: {
  file: CapturedFile;
  onClick: () => void;
}) {
  const isImage = file.mimeType.startsWith('image/');
  const thumbnailSrc = file.thumbnailUrl || buildVfsThumbnailUrl(file.hash);

  return (
    <div className={styles.captureItem} onClick={onClick}>
      <div className={styles.thumbnailContainer}>
        {isImage ? (
          <img src={thumbnailSrc} alt={file.filename} className={styles.thumbnail} loading="lazy" />
        ) : (
          <div className={styles.videoPlaceholder}>
            <span>🎬</span>
          </div>
        )}
        {file.classifyStatus && <StatusIndicator status={file.classifyStatus} />}
      </div>
      <div className={styles.captureInfo}>
        <span className={styles.captureTime}>{new Date(file.capturedAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
});

/**
 * CaptureStream main component
 */
const CaptureStream = memo(function CaptureStream({
  files,
  maxItems = 10,
  onItemClick,
}: CaptureStreamProps) {
  const { t } = useTranslation();

  const displayFiles = files.slice(0, maxItems);

  const handleItemClick = useCallback(
    (file: CapturedFile) => {
      if (onItemClick) {
        onItemClick(file);
      }
    },
    [onItemClick]
  );

  if (displayFiles.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>{t('captureStream.title', '实时捕获')}</span>
        <span className={styles.count}>{displayFiles.length}</span>
      </div>
      <div className={styles.stream}>
        {displayFiles.map((file) => (
          <CaptureItem key={file.hash} file={file} onClick={() => handleItemClick(file)} />
        ))}
      </div>
    </div>
  );
});

export default CaptureStream;
