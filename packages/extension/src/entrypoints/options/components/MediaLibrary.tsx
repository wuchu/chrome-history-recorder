import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  getSourceDomains,
  getTagCounts,
  listTags,
  reconnectVFS,
  refreshTask,
  setFileStarred,
  type SourceDomainCount,
  type TagCounts,
  type TaskStatus,
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
  type BackgroundEvent,
  type CombinedMediaItem,
} from '../../media-browser/hooks';
import { appStyles } from '../../media-browser/styles';
import { buildVfsDownloadUrl } from '../../media-browser/utils/media';
import {
  ExportCancelledError,
  ExportLimitError,
  exportMedia,
  type ExportProgress,
} from '../media-export';
import styles from './MediaLibrary.module.css';

const { Text, Title } = Typography;

type SortValue =
  | 'captured_at:desc'
  | 'captured_at:asc'
  | 'size:desc'
  | 'size:asc'
  | 'confidence:desc'
  | 'ai_filename:asc';

type DatePreset = 'all' | 'today' | '7d' | '30d' | '90d';

interface LibraryFilters {
  q: string;
  mimeType?: 'image' | 'video';
  sourceDomain?: string;
  datePreset: DatePreset;
  starred: boolean;
  classifyStatus?: TaskStatus;
  tags: string[];
  tagMode: 'and' | 'or';
  sort: SortValue;
  activeTag: string;
}

const DEFAULT_FILTERS: LibraryFilters = {
  q: '',
  datePreset: 'all',
  starred: false,
  tags: [],
  tagMode: 'or',
  sort: 'captured_at:desc',
  activeTag: 'all',
};

const STORAGE_KEY = 'media-library-filters-v1';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: '全部时间' },
  { value: 'today', label: '今天' },
  { value: '7d', label: '最近 7 天' },
  { value: '30d', label: '最近 30 天' },
  { value: '90d', label: '最近 90 天' },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'pending', label: '待分类' },
  { value: 'processing', label: '分类中' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'skipped', label: '已跳过' },
];

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'captured_at:desc', label: '最新优先' },
  { value: 'captured_at:asc', label: '最早优先' },
  { value: 'size:desc', label: '最大优先' },
  { value: 'size:asc', label: '最小优先' },
  { value: 'confidence:desc', label: '置信度最高' },
  { value: 'ai_filename:asc', label: '文件名 A–Z' },
];

function loadFilters(): LibraryFilters {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as Partial<LibraryFilters>;
    return {
      ...DEFAULT_FILTERS,
      ...parsed,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((tag) => typeof tag === 'string') : [],
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function capturedFromForPreset(preset: DatePreset): string | undefined {
  if (preset === 'all') return undefined;
  const now = new Date();
  if (preset === 'today') {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

function splitSort(sort: SortValue): {
  orderBy: 'captured_at' | 'size' | 'confidence' | 'ai_filename';
  order: 'asc' | 'desc';
} {
  const [orderBy, order] = sort.split(':') as [
    'captured_at' | 'size' | 'confidence' | 'ai_filename',
    'asc' | 'desc',
  ];
  return { orderBy, order };
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      results.push(await worker(current));
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Global media library for the Options console.
 *
 * Reuses the historical-media and masonry components from the former Side
 * Panel media browser, but owns only browse/curate/export actions. Capture
 * control and the live session cockpit stay in the Side Panel.
 */
export function MediaLibrary() {
  const [filters, setFilters] = useState<LibraryFilters>(loadFilters);
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const [selectedItem, setSelectedItem] = useState<CombinedMediaItem | null>(null);
  const [tagVocabulary, setTagVocabulary] = useState<VFSTagRecord[]>([]);
  const [tagCounts, setTagCounts] = useState<TagCounts>({ all: 0 });
  const [sourceDomains, setSourceDomains] = useState<SourceDomainCount[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);
  const theme = useTheme();

  const loadTags = useCallback(async () => {
    try {
      const [counts, tags] = await Promise.all([getTagCounts(), listTags({ limit: 500 })]);
      setTagCounts(counts ?? { all: 0 });
      setTagVocabulary(Array.isArray(tags) ? tags : []);
    } catch (error) {
      console.error('[MediaLibrary] Failed to load tag vocabulary:', error);
    }
  }, []);

  const handleBackgroundEvent = useCallback(
    (event: BackgroundEvent) => {
      if (event.type !== 'tags:updated') return;
      const data = event.data as { tags?: unknown; counts?: unknown } | null | undefined;
      if (Array.isArray(data?.tags) && data?.counts && typeof data.counts === 'object') {
        setTagVocabulary(data.tags as VFSTagRecord[]);
        setTagCounts(data.counts as TagCounts);
        return;
      }
      // Legacy payload-less event: fall back to one debounced fetch.
      void loadTags();
    },
    [loadTags]
  );

  const { events, vfsConnected, sendMessage } = useBackgroundMessaging({
    onEvent: handleBackgroundEvent,
  });

  const { orderBy, order } = splitSort(filters.sort);
  const queryTag =
    filters.activeTag !== 'all'
      ? filters.activeTag.startsWith('system:')
        ? filters.activeTag.slice('system:'.length)
        : filters.activeTag
      : undefined;

  const historical = useHistoricalImages({
    limit: 50,
    autoLoad: true,
    q: filters.q.trim() || undefined,
    mimeType: filters.mimeType,
    sourceDomain: filters.sourceDomain,
    capturedFrom: capturedFromForPreset(filters.datePreset),
    starred: filters.starred || undefined,
    classifyStatus: filters.classifyStatus,
    tag: queryTag,
    tags: filters.activeTag === 'all' ? filters.tags : undefined,
    tagMode: filters.tagMode,
    orderBy,
    order,
  });

  const hasActiveFilters = Boolean(
    filters.q.trim() ||
    filters.mimeType ||
    filters.sourceDomain ||
    filters.datePreset !== 'all' ||
    filters.starred ||
    filters.classifyStatus ||
    filters.sort !== 'captured_at:desc' ||
    (filters.activeTag === 'all' ? filters.tags.length > 0 : filters.activeTag !== 'all')
  );

  const liveEvents = useMemo(() => (hasActiveFilters ? [] : events), [hasActiveFilters, events]);

  const combinedMedia = useCombinedMedia({
    historicalItems: historical.items,
    backgroundEvents: liveEvents,
  });

  const filteredMedia = combinedMedia.items;
  const total = historical.total + (hasActiveFilters ? 0 : combinedMedia.newItemCount);

  const loadSourceDomains = useCallback(async () => {
    try {
      const domains = await getSourceDomains(100);
      setSourceDomains(Array.isArray(domains) ? domains : []);
    } catch (error) {
      console.error('[MediaLibrary] Failed to load source domains:', error);
    }
  }, []);

  useEffect(() => {
    void loadTags();
    void loadSourceDomains();
  }, [loadTags, loadSourceDomains]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // Ignore storage failures; the library still works without persistence.
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => (prev.q === searchDraft ? prev : { ...prev, q: searchDraft }));
    }, 250);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const filterSignature = JSON.stringify(filters);
  useEffect(() => {
    setSelectedHashes(new Set());
  }, [filterSignature]);

  const prevConnectedRef = useRef<boolean | null>(null);
  const refreshHistorical = historical.refresh;
  useEffect(() => {
    const previous = prevConnectedRef.current;
    if (previous !== null && !previous && vfsConnected) {
      refreshHistorical();
      void loadTags();
      void loadSourceDomains();
    }
    prevConnectedRef.current = vfsConnected;
  }, [vfsConnected, refreshHistorical, loadTags, loadSourceDomains]);

  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  useEffect(() => {
    if (!hasActiveFilters || !lastEvent) return;
    if (
      ![
        'file:captured',
        'file:trashed',
        'file:restored',
        'classify:complete',
        'file:classified',
        'rename:complete',
        'task:completed',
      ].includes(lastEvent.type)
    ) {
      return;
    }
    const timer = setTimeout(() => refreshHistorical(), 500);
    return () => clearTimeout(timer);
  }, [hasActiveFilters, lastEvent, refreshHistorical]);

  useEffect(() => {
    if (!selectedItem) return;
    const next = filteredMedia.find((item) => item.hash === selectedItem.hash);
    if (!next) {
      setSelectedItem(null);
      return;
    }
    if (next !== selectedItem) {
      setSelectedItem(next);
    }
  }, [filteredMedia, selectedItem]);

  const visibleTabs = useMemo((): Tab[] => {
    return getVisibleTabsFromVocabulary(tagVocabulary, tagCounts);
  }, [tagVocabulary, tagCounts]);

  const tagOptions = useMemo(() => {
    const options = tagVocabulary.map((tag) => ({
      value: tag.name,
      label: `#${tag.label || tag.name} (${tag.usage_count})`,
    }));
    const known = new Set(options.map((option) => option.value));
    for (const tag of filters.tags) {
      if (!known.has(tag)) {
        options.push({ value: tag, label: `#${tag}` });
      }
    }
    return options;
  }, [tagVocabulary, filters.tags]);

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

  const handleDelete = useCallback(
    async (hash: string) => {
      try {
        await sendMessage({ type: 'trashFile', hash });
        if (selectedItem?.hash === hash) setSelectedItem(null);
        void loadTags();
      } catch (error) {
        console.error('[MediaLibrary] Failed to move item to trash:', error);
        message.error('移入回收站失败');
      }
    },
    [selectedItem, sendMessage, loadTags]
  );

  const requestDelete = useCallback(
    (hash: string) => {
      Modal.confirm({
        title: '移入回收站',
        content: '删除后将从媒体库移除并移入回收站，可稍后恢复或永久删除。确定继续吗？',
        okText: '移入回收站',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => handleDelete(hash),
      });
    },
    [handleDelete]
  );

  const toggleSelect = useCallback((hash: string) => {
    setSelectedHashes((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSearchDraft('');
    setFilters(DEFAULT_FILTERS);
  }, []);

  const selectedItems = useMemo(
    () => filteredMedia.filter((item) => selectedHashes.has(item.hash)),
    [filteredMedia, selectedHashes]
  );

  const handleBulkTrash = useCallback(() => {
    if (selectedItems.length === 0) return;
    Modal.confirm({
      title: '批量移入回收站',
      content: `确定将 ${selectedItems.length} 项移入回收站吗？它们可以稍后恢复。`,
      okText: '移入回收站',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        let failed = 0;
        await mapLimit(selectedItems, 4, async (item) => {
          try {
            await sendMessage({ type: 'trashFile', hash: item.hash });
          } catch (error) {
            failed += 1;
            console.error('[MediaLibrary] Batch trash failed:', item.hash, error);
          }
        });
        setSelectedHashes(new Set());
        void loadTags();
        if (failed > 0) {
          message.warning(`${failed} 项移入回收站失败`);
        } else {
          message.success(`已移入回收站 ${selectedItems.length} 项`);
        }
      },
    });
  }, [selectedItems, sendMessage, loadTags]);

  const handleBulkRequeue = useCallback(
    async (taskType: 'classify' | 'rename') => {
      if (selectedItems.length === 0) return;
      let failed = 0;
      await mapLimit(selectedItems, 4, async (item) => {
        try {
          const result = await refreshTask(taskType, item.hash);
          if (!result.success && !result.skipped) failed += 1;
        } catch (error) {
          failed += 1;
          console.error('[MediaLibrary] Batch requeue failed:', item.hash, error);
        }
      });
      if (failed > 0) {
        message.warning(`${failed} 项重新入队失败`);
      } else {
        message.success(`已重新入队 ${selectedItems.length} 项`);
      }
    },
    [selectedItems]
  );

  const handleBulkExport = useCallback(async () => {
    if (selectedItems.length === 0) return;
    const controller = new AbortController();
    exportAbortRef.current = controller;
    setExporting(true);
    setExportProgress({ completed: 0, total: selectedItems.length, currentName: '' });
    try {
      const result = await exportMedia(selectedItems, {
        signal: controller.signal,
        onProgress: setExportProgress,
      });
      const failureText =
        result.failures.length > 0 ? `，${result.failures.length} 项读取失败` : '';
      message.success(`已导出 ${result.exported} 项${failureText}`);
    } catch (error) {
      if (error instanceof ExportCancelledError) {
        message.info('已取消导出');
      } else if (error instanceof ExportLimitError) {
        message.warning(error.message);
      } else {
        const text = error instanceof Error ? error.message : '导出失败';
        message.error(text);
      }
    } finally {
      setExporting(false);
      setExportProgress(null);
      exportAbortRef.current = null;
    }
  }, [selectedItems]);

  const handleCancelExport = useCallback(() => {
    exportAbortRef.current?.abort();
  }, []);

  const handleToggleStar = useCallback(
    async (hash: string, starred: boolean) => {
      try {
        await setFileStarred(hash, starred);
        historical.updateItem(hash, { isStarred: starred });
        void loadTags();
      } catch (error) {
        console.error('[MediaLibrary] Failed to update star state:', error);
        message.error('更新收藏状态失败');
      }
    },
    [historical, loadTags]
  );

  const handleNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (!selectedItem) return;
      const index = filteredMedia.findIndex((item) => item.hash === selectedItem.hash);
      if (index < 0) return;
      const nextIndex = direction === 'prev' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= filteredMedia.length) return;
      setSelectedItem(filteredMedia[nextIndex]);
    },
    [filteredMedia, selectedItem]
  );

  const selectedIndex = selectedItem
    ? filteredMedia.findIndex((item) => item.hash === selectedItem.hash)
    : -1;

  const themeClass = theme.themeClass(appStyles.lightTheme, appStyles.darkTheme);
  const showInitialLoading = historical.loading && historical.items.length === 0;

  const sourceDomainOptions = sourceDomains.map((entry) => ({
    value: entry.domain,
    label: `${entry.domain} (${entry.count})`,
  }));

  return (
    <div className={styles.library}>
      <div className={styles.header}>
        <div>
          <Title level={4} className={styles.title}>
            媒体库
          </Title>
          <Text type="secondary">
            全局浏览、搜索和管理所有已捕获的图片与视频。捕获会话仍在侧边栏中进行。
          </Text>
        </div>
        <Space wrap>
          <Tag>共 {total} 个</Tag>
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
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <Input
            allowClear
            size="small"
            value={searchDraft}
            disabled={!vfsConnected}
            placeholder="搜索文件名 / 标签 / 来源"
            style={{ width: 220 }}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
          <Select
            allowClear
            size="small"
            disabled={!vfsConnected}
            placeholder="类型"
            style={{ width: 90 }}
            value={filters.mimeType}
            options={[
              { value: 'image', label: '图片' },
              { value: 'video', label: '视频' },
            ]}
            onChange={(mimeType) => setFilters((prev) => ({ ...prev, mimeType }))}
          />
          <Select
            allowClear
            size="small"
            showSearch
            disabled={!vfsConnected}
            placeholder="来源站点"
            style={{ width: 150 }}
            value={filters.sourceDomain}
            options={sourceDomainOptions}
            optionFilterProp="label"
            onChange={(sourceDomain) => setFilters((prev) => ({ ...prev, sourceDomain }))}
          />
          <Select
            size="small"
            disabled={!vfsConnected}
            style={{ width: 110 }}
            value={filters.datePreset}
            options={DATE_PRESETS}
            onChange={(datePreset: DatePreset) => setFilters((prev) => ({ ...prev, datePreset }))}
          />
          <Select
            allowClear
            size="small"
            disabled={!vfsConnected}
            placeholder="分类状态"
            style={{ width: 110 }}
            value={filters.classifyStatus}
            options={STATUS_OPTIONS}
            onChange={(classifyStatus: TaskStatus | undefined) =>
              setFilters((prev) => ({ ...prev, classifyStatus }))
            }
          />
          <Select
            size="small"
            disabled={!vfsConnected}
            style={{ width: 120 }}
            value={filters.sort}
            options={SORT_OPTIONS}
            onChange={(sort: SortValue) => setFilters((prev) => ({ ...prev, sort }))}
          />
          <Select
            mode="multiple"
            allowClear
            size="small"
            showSearch
            disabled={!vfsConnected}
            placeholder="标签"
            style={{ minWidth: 180, maxWidth: 300 }}
            value={filters.tags}
            options={tagOptions}
            optionFilterProp="label"
            onChange={(tags: string[]) =>
              setFilters((prev) => ({ ...prev, tags, activeTag: 'all' }))
            }
          />
          <Select
            size="small"
            disabled={!vfsConnected || filters.tags.length < 2}
            style={{ width: 90 }}
            value={filters.tagMode}
            options={[
              { value: 'or', label: '任一标签' },
              { value: 'and', label: '全部标签' },
            ]}
            onChange={(tagMode: 'and' | 'or') => setFilters((prev) => ({ ...prev, tagMode }))}
          />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <Switch
              size="small"
              checked={filters.starred}
              disabled={!vfsConnected}
              onChange={(starred) => setFilters((prev) => ({ ...prev, starred }))}
            />
            <span>仅收藏</span>
          </label>
          <Button
            size="small"
            disabled={!vfsConnected}
            onClick={() => {
              setSelectionMode((prev) => !prev);
              setSelectedHashes(new Set());
            }}
          >
            {selectionMode ? '退出选择' : '选择'}
          </Button>
        </div>

        {selectionMode && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              marginBottom: 8,
              padding: '8px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: 8,
            }}
          >
            <Text strong>已选 {selectedHashes.size} 项</Text>
            <Button
              size="small"
              onClick={() => setSelectedHashes(new Set(filteredMedia.map((item) => item.hash)))}
            >
              全选当前 {filteredMedia.length} 项
            </Button>
            <Button size="small" onClick={() => setSelectedHashes(new Set())}>
              清空
            </Button>
            <Button size="small" danger disabled={!selectedHashes.size} onClick={handleBulkTrash}>
              移入回收站
            </Button>
            <Button
              size="small"
              disabled={!selectedHashes.size}
              onClick={() => void handleBulkRequeue('classify')}
            >
              重新分类
            </Button>
            <Button
              size="small"
              disabled={!selectedHashes.size}
              onClick={() => void handleBulkRequeue('rename')}
            >
              重新命名
            </Button>
            <Button
              size="small"
              type="primary"
              disabled={!selectedHashes.size || exporting}
              loading={exporting}
              onClick={() => void handleBulkExport()}
            >
              导出
            </Button>
            {exporting && (
              <Button size="small" onClick={handleCancelExport}>
                取消导出
              </Button>
            )}
          </div>
        )}

        {exportProgress && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 8 }}
            message={`正在导出 ${exportProgress.completed}/${exportProgress.total}：${exportProgress.currentName}`}
          />
        )}

        <ScrollableTabBar
          tabs={visibleTabs}
          activeTabId={filters.activeTag}
          onTabChange={(activeTag) => setFilters((prev) => ({ ...prev, activeTag, tags: [] }))}
        />
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
            selectionMode={selectionMode}
            selectedHashes={selectedHashes}
            onToggleSelect={toggleSelect}
            emptyMessage={hasActiveFilters ? '没有匹配的媒体' : '还没有捕获媒体'}
            emptyAction={
              hasActiveFilters ? (
                <Button size="small" onClick={clearFilters}>
                  清除筛选
                </Button>
              ) : (
                <Text type="secondary">在侧边栏开始捕获后，媒体会出现在这里。</Text>
              )
            }
          />
        )}
      </div>

      {selectedItem && (
        <MediaDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDeleteRequest={requestDelete}
          onRefreshTask={handleRefreshTask}
          onToggleStar={handleToggleStar}
          onDownload={(item) => {
            void chrome.downloads.download({ url: buildVfsDownloadUrl(item.hash), saveAs: true });
          }}
          onNavigate={handleNavigate}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex >= 0 && selectedIndex < filteredMedia.length - 1}
        />
      )}
    </div>
  );
}

export default MediaLibrary;
