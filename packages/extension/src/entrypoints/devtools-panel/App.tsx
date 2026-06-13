import { useState, useEffect, useCallback, useMemo } from 'react';
import StatusBar from './components/StatusBar';
import VirtualMasonryGrid from './components/VirtualMasonryGrid';
import ClassifyProgressSection from './components/ClassifyProgressSection';
import CaptureStream from './components/CaptureStream';
import MediaDetail from './components/MediaDetail';
import ScrollableTabBar, { type Tab } from './components/ScrollableTabBar';
import { useBackgroundMessaging, useCapturedFiles, useClassifyEvents } from './hooks/useBackgroundMessaging';
import { useNetworkListener } from './hooks/useNetworkListener';
import { useHistoricalImages } from './hooks/useHistoricalImages';
import { useTheme } from './hooks/useTheme';
import { useClassifyQueue } from './hooks/useClassifyQueue';
import { useCombinedMedia, type CombinedMediaItem } from './hooks/useCombinedMedia';
import { getConfig, getTagCounts, type TagDefinition, type TagCounts } from '../../shared/extension-runtime';
import {
  getVisibleTabs,
  getSystemTagsForFile,
  parseTags,
  isUncategorized,
} from '../../shared/tag-utils';
import {
  DEFAULT_VIDEO_TYPES,
  DEFAULT_MIN_IMAGE_SIZE_KB,
  DEFAULT_MIN_VIDEO_SIZE_MB,
} from './constants';
import styles from './App.module.css';

type ActiveTab = string;

function App() {
  // 规则: rerender-split-combined-hooks - 简单状态保持在组件内
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const theme = useTheme();
  const [userDefinedTags, setUserDefinedTags] = useState<TagDefinition[]>([]);
  const [tagCounts, setTagCounts] = useState<TagCounts>({ all: 0 });

  // Background messaging hook for real-time events (replaces WebSocket)
  const {
    events: backgroundEvents,
    vfsConnected,
    ollamaAvailable,
    clearEvents: clearBackgroundEvents,
  } = useBackgroundMessaging();

  // Load config and tag counts
  const loadTagCounts = useCallback(async () => {
    try {
      const counts = await getTagCounts();
      setTagCounts(counts);
    } catch (e) {
      console.error('Failed to load tag counts:', e);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const config = await getConfig();
        setUserDefinedTags(config.userDefinedTags || []);
      } catch (e) {
        console.error('Failed to load config:', e);
      }

      await loadTagCounts();
    };
    loadData();
  }, [loadTagCounts]);

  // Refresh tag counts when classification completes
  useEffect(() => {
    const hasCompleteEvent = backgroundEvents.some(
      (e) => e.type === 'classify:complete' || e.type === 'file:classified'
    );
    if (hasCompleteEvent) {
      loadTagCounts();
    }
  }, [backgroundEvents, loadTagCounts]);

  // Process Background events
  const capturedFiles = useCapturedFiles(backgroundEvents);
  const classifyStatus = useClassifyEvents(backgroundEvents);

  // Historical images hook (from VFS via Background) with tag filtering
  const historicalImages = useHistoricalImages({
    limit: 50,
    autoLoad: true,
    tag: activeTab !== 'all' ? activeTab : undefined,
  });

  // Classify queue status hook
  const classifyQueue = useClassifyQueue({
    backgroundEvents,
  });

  // 网络监听器 hook (用于捕获)
  const {
    isCapturing,
    images,
    videos,
    toggleCapture,
    clearImages,
    clearVideos,
    checkServiceHealth,
  } = useNetworkListener({
    minImageSizeKB: DEFAULT_MIN_IMAGE_SIZE_KB,
    minVideoSizeMB: DEFAULT_MIN_VIDEO_SIZE_MB,
    videoTypes: DEFAULT_VIDEO_TYPES,
  });

  // 详情面板状态
  const [selectedItem, setSelectedItem] = useState<CombinedMediaItem | null>(null);

  // Theme class - 使用 useMemo 缓存计算结果
  const themeClass = useMemo(() => {
    return theme.themeClass(styles.lightTheme, styles.darkTheme);
  }, [theme]);

  // Build visible tabs
  const visibleTabs = useMemo((): Tab[] => {
    return getVisibleTabs(userDefinedTags, tagCounts);
  }, [userDefinedTags, tagCounts]);

  // 合并历史数据 + Background 实时数据
  const combinedMedia = useCombinedMedia({
    historicalItems: historicalImages.items,
    backgroundEvents: backgroundEvents,
  });

  // Filter media by active tab
  const filteredMedia = useMemo(() => {
    if (activeTab === 'all') {
      return combinedMedia.items;
    }

    return combinedMedia.items.filter((m) => {
      // Check system tags first
      const systemTags = getSystemTagsForFile(m.mimeType, false); // starred handled separately
      if (systemTags.includes(activeTab)) {
        return true;
      }

      // Check starred
      if (activeTab === 'starred') {
        return false; // TODO: Implement starred field in CombinedMediaItem
      }

      // Check uncategorized
      if (activeTab === 'uncategorized') {
        const userTags = parseTags(m.tags);
        // Filter out system tags (those with prefix)
        const actualUserTags = userTags.filter(t => !t.startsWith('system:'));
        return isUncategorized(actualUserTags);
      }

      // Check user tags
      const userTags = parseTags(m.tags);
      return userTags.includes(activeTab);
    });
  }, [combinedMedia.items, activeTab]);

  // Health check interval
  useEffect(() => {
    const healthInterval = setInterval(checkServiceHealth, 5000);

    return () => {
      clearInterval(healthInterval);
    };
  }, [checkServiceHealth]);

  // 处理点击媒体项
  const handleItemClick = useCallback((item: CombinedMediaItem) => {
    setSelectedItem(item);
  }, []);

  // 处理关闭详情面板
  const handleCloseDetail = useCallback(() => {
    setSelectedItem(null);
  }, []);

  // 重新加入 AI 分类/命名队列
  const handleRequeue = useCallback(async (hash: string) => {
    const response = await chrome.runtime.sendMessage({
      type: 'requeueClassification',
      hash,
      priority: 10,
    });
    if (!response?.success) {
      throw new Error(response?.error || '重新加入队列失败');
    }
  }, []);

  // 处理 CaptureStream 点击跳转
  const handleCaptureItemClick = useCallback((file: any) => {
    setActiveTab(file.mimeType.startsWith('video/') ? 'videos' : 'images');
    setSelectedItem(file);
  }, []);

  // 清空媒体列表
  const handleClear = useCallback(() => {
    if (activeTab === 'images') {
      clearImages();
    } else {
      clearVideos();
    }
    clearBackgroundEvents();
  }, [activeTab, clearImages, clearVideos, clearBackgroundEvents]);

  return (
    <div className={`${styles.panel} ${themeClass}`}>
      <StatusBar
        serviceOnline={vfsConnected && ollamaAvailable}
        isCapturing={isCapturing}
        vfsConnected={vfsConnected}
        ollamaAvailable={ollamaAvailable}
        classifyQueue={classifyQueue.status}
        onToggleCapture={toggleCapture}
      />

      {/* 实时捕获流 */}
      {isCapturing && capturedFiles.length > 0 && (
        <CaptureStream
          files={capturedFiles.map((f) => ({
            ...f,
            classifyStatus: classifyStatus[f.hash]?.status,
            classifyData: classifyStatus[f.hash]?.data as any,
          }))}
          maxItems={10}
          onItemClick={handleCaptureItemClick}
        />
      )}

      {/* 分类进度 */}
      <ClassifyProgressSection
        status={classifyQueue.status}
        loading={classifyQueue.loading}
        onStart={classifyQueue.startClassification}
        onPause={classifyQueue.pauseClassification}
        onRetryFailed={classifyQueue.retryFailed}
        onClearQueue={classifyQueue.clearQueue}
      />

      <ScrollableTabBar
        tabs={visibleTabs}
        activeTabId={activeTab}
        onTabChange={setActiveTab}
      />

      <VirtualMasonryGrid
        items={filteredMedia}
        onLoadMore={historicalImages.loadMore}
        onItemClick={handleItemClick}
        onRequeue={handleRequeue}
        hasMore={historicalImages.hasMore}
        loading={historicalImages.loading}
      />

      {/* 详情面板 */}
      {selectedItem && (
        <MediaDetail
          item={selectedItem}
          onClose={handleCloseDetail}
          onRequeue={handleRequeue}
        />
      )}
    </div>
  );
}

export default App;