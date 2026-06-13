/**
 * VirtualMasonryGrid Component
 *
 * Virtualized Masonry grid using @virtuoso.dev/masonry.
 */

import { memo, useRef, useCallback, useEffect, useState } from 'react';
import { VirtuosoMasonry } from '@virtuoso.dev/masonry';
import type { CombinedMediaItem } from '../hooks/useCombinedMedia';
import { useColumnCount } from '../hooks/useColumnCount';
import MasonryItem from './MasonryItem';
import styles from './VirtualMasonryGrid.module.css';

interface VirtualMasonryGridProps {
  items: CombinedMediaItem[];
  onLoadMore?: () => void;
  onItemClick?: (item: CombinedMediaItem) => void;
  onRequeue?: (hash: string) => Promise<void>;
  hasMore?: boolean;
  loading?: boolean;
}

interface VirtuosoItemContentProps {
  data?: CombinedMediaItem;
  item?: CombinedMediaItem;
  index?: number;
}

/**
 * Masonry Item Content Component for VirtuosoMasonry
 *
 * VirtuosoMasonry passes { data, index, context } to ItemContent
 */
const MasonryItemContent = memo(function MasonryItemContent({
  data,
  onItemClick,
  onRequeue,
}: {
  data?: CombinedMediaItem;
  onItemClick?: (item: CombinedMediaItem) => void;
  onRequeue?: (hash: string) => Promise<void>;
}) {
  if (!data?.hash) {
    console.warn('[VirtualMasonryGrid] Skipping invalid masonry item:', data);
    return null;
  }

  return (
    <div className={styles.itemWrapper}>
      <MasonryItem
        item={data}
        onClick={() => onItemClick?.(data)}
        onRequeue={onRequeue}
      />
    </div>
  );
});

/**
 * VirtualMasonryGrid main component
 */
const VirtualMasonryGrid = memo(function VirtualMasonryGrid({
  items,
  onLoadMore,
  onItemClick,
  onRequeue,
  hasMore = false,
  loading = false,
}: VirtualMasonryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNearEnd, setIsNearEnd] = useState(false);

  // Responsive column count
  const { columnCount } = useColumnCount({
    containerRef,
    columnWidth: 200,
    gap: 10,
  });

  // Detect page scroll near end for infinite loading.
  const handleScroll = useCallback(() => {
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    const nearEnd = scrollHeight - scrollTop - clientHeight < 200;

    if (nearEnd && !isNearEnd && hasMore && !loading && onLoadMore) {
      setIsNearEnd(true);
      onLoadMore();
    } else if (!nearEnd) {
      setIsNearEnd(false);
    }
  }, [hasMore, loading, onLoadMore, isNearEnd]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Empty state
  if (items.length === 0 && !loading) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>暂无媒体</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={styles.container}>
      <VirtuosoMasonry
        data={items}
        columnCount={columnCount}
        useWindowScroll
        ItemContent={(props: VirtuosoItemContentProps) => {
          const item = props.data ?? props.item ?? (typeof props.index === 'number' ? items[props.index] : undefined);
          return (
            <MasonryItemContent
              data={item}
              onItemClick={onItemClick}
              onRequeue={onRequeue}
            />
          );
        }}
        initialItemCount={50}
      />

      {loading && (
        <div className={styles.loadingIndicator}>
          <span>加载中...</span>
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <div className={styles.endIndicator}>
          <span>已加载全部 {items.length} 个媒体</span>
        </div>
      )}
    </div>
  );
});

export default VirtualMasonryGrid;