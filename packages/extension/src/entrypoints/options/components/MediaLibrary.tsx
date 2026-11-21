import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Modal, Space, Spin, Tag, Typography, message } from 'antd';
import {
  getTagCounts,
  listTags,
  reconnectVFS,
  refreshTask,
  type TagCounts,
  type VFSTagRecord,
} from '../../../shared/extension-runtime';
import { getVisibleTabsFromVocabulary } from '../../../shared/tag-utils';
import {
  MediaDetail,
  ScrollableTabBar,
  VirtualMasonryGrid,
  type Tab,
} from '../../media-browser/components';
import {
  useBackgroundMessaging,
  useCombinedMedia,
  useHistoricalImages,
  useTheme,
  type CombinedMediaItem,
} from '../../media-browser/hooks';
import { appStyles } from '../../media-browser/styles';
import { filterMediaByTag } from '../media-filter';
import styles from './MediaLibrary.module.css';

const { Text, Title } = Typography;

/**
 * Global media library for the Options console.
 *
 * Reuses the historical-media and masonry components from the former Side
 * Panel media browser, but owns only browse/delete/requeue actions. Capture
 * control and the live session cockpit stay in the Side Panel.
 */
export function MediaLibrary() {
  const [activeTag, setActiveTag] = useState('all');
  const [selectedItem, setSelectedItem] = useState<CombinedMediaItem | null>(null);
  const [tagVocabulary, setTagVocabulary] = useState<VFSTagRecord[]>([]);
  const [tagCounts, setTagCounts] = useState<TagCounts>({ all: 0 });
  const theme = useTheme();
  const { events, vfsConnected, sendMessage } = useBackgroundMessaging();

  const queryTag = activeTag.startsWith('system:') ? activeTag.slice('system:'.length) : activeTag;

  const historical = useHistoricalImages({
    limit: 50,
    autoLoad: true,
    tag: activeTag !== 'all' ? queryTag : undefined,
  });

  const combinedMedia = useCombinedMedia({
    historicalItems: historical.items,
    backgroundEvents: events,
  });

  const loadTags = useCallback(async () => {
    try {
      const [counts, tags] = await Promise.all([getTagCounts(), listTags({ limit: 200 })]);
      setTagCounts(counts);
      setTagVocabulary(tags);
    } catch (error) {
      console.error('[MediaLibrary] Failed to load tag vocabulary:', error);
    }
  }, []);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  useEffect(() => {
    const shouldRefreshTags = events.some(
      (event) =>
        event.type === 'classify:complete' ||
        event.type === 'file:classified' ||
        event.type === 'tags:updated'
    );
    if (shouldRefreshTags) {
      void loadTags();
    }
  }, [events, loadTags]);

  useEffect(() => {
    if (!selectedItem) return;
    const next = combinedMedia.items.find((item) => item.hash === selectedItem.hash);
    if (!next) {
      setSelectedItem(null);
      return;
    }
    if (next !== selectedItem) {
      setSelectedItem(next);
    }
  }, [combinedMedia.items, selectedItem]);

  const visibleTabs = useMemo((): Tab[] => {
    return getVisibleTabsFromVocabulary(tagVocabulary, tagCounts);
  }, [tagVocabulary, tagCounts]);

  const filteredMedia = useMemo(
    () => filterMediaByTag(combinedMedia.items, activeTag),
    [activeTag, combinedMedia.items]
  );

  const handleDelete = useCallback(
    async (hash: string) => {
      try {
        await sendMessage({ type: 'deleteFile', hash });
        if (selectedItem?.hash === hash) setSelectedItem(null);
      } catch (error) {
        console.error('[MediaLibrary] Failed to delete item:', error);
      }
    },
    [selectedItem, sendMessage]
  );

  const requestDelete = useCallback(
    (hash: string) => {
      Modal.confirm({
        title: '删除媒体',
        content: '删除后将从媒体库中移除。确定继续吗？',
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => handleDelete(hash),
      });
    },
    [handleDelete]
  );

  const handleRefreshTask = useCallback((taskType: 'classify' | 'rename', hash: string) => {
    refreshTask(taskType, hash)
      .then((result) => {
        if (!result.success && result.reason) {
          message.warning(result.reason);
        }
      })
      .catch((error) => {
        console.error(`[MediaLibrary] Failed to requeue ${taskType} for ${hash}:`, error);
      });
  }, []);

  const themeClass = theme.themeClass(appStyles.lightTheme, appStyles.darkTheme);
  const showInitialLoading = historical.loading && historical.items.length === 0;

  return (
    <div className={styles.library}>
      <div className={styles.header}>
        <div>
          <Title level={4} className={styles.title}>
            媒体库
          </Title>
          <Text type="secondary">
            全局浏览和管理所有已捕获的图片与视频。捕获会话仍在侧边栏中进行。
          </Text>
        </div>
        <Space wrap>
          <Tag>共 {historical.total} 个</Tag>
          <Tag color={vfsConnected ? 'green' : 'red'}>
            {vfsConnected ? 'VFS 已连接' : 'VFS 未连接'}
          </Tag>
          <Button onClick={historical.refresh} loading={historical.loading}>
            刷新
          </Button>
        </Space>
      </div>

      {!vfsConnected && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="VFS 未连接"
          description="当前列表可能不是最新数据。请先启动本地服务，然后重连。"
          action={
            <Button size="small" onClick={() => void reconnectVFS()}>
              重连
            </Button>
          }
        />
      )}

      {historical.error && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} message={historical.error} />
      )}

      <div className={`${appStyles.panel} ${themeClass} ${styles.mediaSurface}`}>
        <ScrollableTabBar tabs={visibleTabs} activeTabId={activeTag} onTabChange={setActiveTag} />
        {showInitialLoading ? (
          <div className={styles.loading}>
            <Spin tip="加载媒体中…" />
          </div>
        ) : (
          <VirtualMasonryGrid
            items={filteredMedia}
            onLoadMore={historical.loadMore}
            onItemClick={setSelectedItem}
            onItemDeleteRequest={requestDelete}
            hasMore={historical.hasMore}
            loading={historical.loading}
          />
        )}
      </div>

      {selectedItem && (
        <MediaDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDeleteRequest={requestDelete}
          onRefreshTask={handleRefreshTask}
        />
      )}
    </div>
  );
}

export default MediaLibrary;
