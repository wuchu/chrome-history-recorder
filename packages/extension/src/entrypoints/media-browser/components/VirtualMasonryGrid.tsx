/**
 * VirtualMasonryGrid Component
 *
 * Virtualized Masonry grid using @virtuoso.dev/masonry.
 */

import { memo, useRef, useEffect, type ReactNode } from 'react';
import { VirtuosoMasonry } from '@virtuoso.dev/masonry';
import type { CombinedMediaItem } from '../hooks/useCombinedMedia';
import { useColumnCount } from '../hooks/useColumnCount';
import MasonryItem from './MasonryItem';
import styles from './VirtualMasonryGrid.module.css';

interface VirtualMasonryGridProps {
  items: CombinedMediaItem[];
  onLoadMore?: () => void;
  onItemClick?: (item: CombinedMediaItem) => void;
  onItemDelete?: (hash: string) => void;
  onItemDeleteRequest?: (hash: string) => void;
  hasMore?: boolean;
  loading?: boolean;
  selectionMode?: boolean;
  selectedHashes?: Set<string>;
  onToggleSelect?: (hash: string) => void;
  emptyMessage?: string;
  emptyAction?: ReactNode;
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
  onItemDelete,
  onItemDeleteRequest,
  selectionMode,
  selected,
  onToggleSelect,
}: {
  data?: CombinedMediaItem;
  onItemClick?: (item: CombinedMediaItem) => void;
  onItemDelete?: (hash: string) => void;
  onItemDeleteRequest?: (hash: string) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (hash: string) => void;
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
        onDelete={onItemDelete}
        onDeleteRequest={onItemDeleteRequest}
        selectionMode={selectionMode}
        selected={selected}
        onToggleSelect={onToggleSelect}
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
  onItemDelete,
  onItemDeleteRequest,
  hasMore = false,
  loading = false,
  selectionMode = false,
  selectedHashes,
  onToggleSelect,
  emptyMessage,
  emptyAction,
}: VirtualMasonryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Responsive column count
  const { columnCount, containerWidth } = useColumnCount({
    containerRef,
    columnWidth: 200,
    gap: 10,
  });
  // Don't mount the grid until the container has a real width. Tab panes can be
  // mounted while hidden (width 0), and measuring/building the masonry at that
  // width leaves items sized to zero — lazy images then never start loading.
  const layoutReady = containerWidth > 0;

  // Observe the end sentinel instead of latching on a scroll event. If a page
  // is short enough that the sentinel stays visible after loading, the freshly
  // re-armed observer triggers the next page immediately.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore?.();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore, items.length, layoutReady]);

  const isEmpty = items.length === 0 && !loading;

  return (
    <div ref={containerRef} className={styles.container}>
      {isEmpty ? (
        <div className={styles.empty}>
          <p>{emptyMessage ?? '暂无媒体'}</p>
          {emptyAction}
        </div>
      ) : layoutReady ? (
        <>
          <VirtuosoMasonry
            // VirtuosoMasonry builds its layout realm once, with the column
            // count from the first render. Our column count starts at 1 and is
            // measured in a layout effect, so the initial realm can be left
            // observing mismatched column indexes and drops the first resize
            // batch — which stacks items on top of each other in columns 2+.
            // Remounting when the column count settles gives the grid a clean
            // realm.
            key={columnCount}
            data={items}
            columnCount={columnCount}
            useWindowScroll
            ItemContent={(props: VirtuosoItemContentProps) => {
              const item =
                props.data ??
                props.item ??
                (typeof props.index === 'number' ? items[props.index] : undefined);
              return (
                <MasonryItemContent
                  data={item}
                  onItemClick={onItemClick}
                  onItemDelete={onItemDelete}
                  onItemDeleteRequest={onItemDeleteRequest}
                  selectionMode={selectionMode}
                  selected={Boolean(item?.hash && selectedHashes?.has(item.hash))}
                  onToggleSelect={onToggleSelect}
                />
              );
            }}
            initialItemCount={50}
          />

          {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}

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
        </>
      ) : (
        <div className={styles.loadingIndicator}>
          <span>加载中...</span>
        </div>
      )}
    </div>
  );
});

export default VirtualMasonryGrid;
