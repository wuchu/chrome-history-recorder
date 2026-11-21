import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionMediaItem } from '../../../shared/extension-runtime';
import { buildVfsThumbnailUrl } from '../../media-browser/utils/media';
import { formatBytes, formatTime } from '../utils';
import styles from '../cockpit.module.css';

interface SessionFeedProps {
  items: SessionMediaItem[];
  onOpenItem: (hash: string) => void;
}

const AI_STATUS_ICONS = {
  pending: '○',
  processing: '◉',
  completed: '✓',
  failed: '✗',
  skipped: '⊘',
} as const;

export function SessionFeed({ items, onOpenItem }: SessionFeedProps) {
  const { t } = useTranslation();
  const [paused, setPaused] = useState(false);
  const [displayItems, setDisplayItems] = useState(items);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef({ width: 0, left: 0 });

  useEffect(() => {
    if (paused) return;
    setDisplayItems(items);
  }, [items, paused]);

  const newCount = useMemo(() => {
    if (!paused) return 0;
    const visibleHashes = new Set(displayItems.map((item) => item.hash));
    return items.filter((item) => !visibleHashes.has(item.hash)).length;
  }, [displayItems, items, paused]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    if (scrollRef.current.left > 0 && scrollRef.current.width > 0) {
      const delta = list.scrollWidth - scrollRef.current.width;
      list.scrollLeft = scrollRef.current.left + delta;
    }
    scrollRef.current = { width: list.scrollWidth, left: list.scrollLeft };
  }, [displayItems]);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;
    scrollRef.current = { width: list.scrollWidth, left: list.scrollLeft };
  };

  const handlePause = () => {
    if (paused) {
      setDisplayItems(items);
      setPaused(false);
    } else {
      setPaused(true);
    }
  };

  return (
    <section className={styles.feedSection}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>
          {t('cockpit.feed.title', '实时捕获')}
          <span className={styles.sectionCount}>{displayItems.length}</span>
        </span>
        <div className={styles.sectionActions}>
          {newCount > 0 && (
            <button type="button" className={styles.newItemsButton} onClick={handlePause}>
              {t('cockpit.feed.newItems', { count: newCount, defaultValue: '{{count}} 个新条目' })}
            </button>
          )}
          <button type="button" className={styles.smallButton} onClick={handlePause}>
            {paused ? t('cockpit.feed.resume', '继续') : t('cockpit.feed.pause', '暂停')}
          </button>
        </div>
      </div>

      {displayItems.length === 0 ? (
        <div className={styles.feedEmpty}>{t('cockpit.feed.empty', '等待本页图片或视频…')}</div>
      ) : (
        <div className={styles.feed} ref={listRef} onScroll={handleScroll}>
          {displayItems.map((item) => {
            const isVideo = item.mimeType.startsWith('video/');
            return (
              <button
                key={`${item.hash}-${item.capturedAt}-${item.duplicate ? 'dup' : 'new'}`}
                type="button"
                className={styles.feedItem}
                onClick={() => onOpenItem(item.hash)}
                title={item.sourceUrl || item.hash}
              >
                <span className={styles.feedThumbWrap}>
                  {item.duplicate ? (
                    <span className={styles.feedDuplicate}>
                      {t('cockpit.feed.exists', '已存在')}
                    </span>
                  ) : isVideo ? (
                    <span className={styles.feedVideoIcon}>🎬</span>
                  ) : (
                    <img
                      className={styles.feedThumb}
                      src={buildVfsThumbnailUrl(item.hash, 'medium')}
                      alt=""
                      loading="lazy"
                    />
                  )}
                  {item.aiStatus && (
                    <span className={`${styles.aiBadge} ${styles[`ai${item.aiStatus}`]}`}>
                      {AI_STATUS_ICONS[item.aiStatus]}
                    </span>
                  )}
                </span>
                <span className={styles.feedMeta}>
                  <span>
                    {item.duplicate ? t('cockpit.feed.duplicate', '重复') : formatBytes(item.size)}
                  </span>
                  <span>{formatTime(item.capturedAt)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default SessionFeed;
