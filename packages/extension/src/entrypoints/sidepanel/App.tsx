import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CaptureStream,
  ClassifyProgressSection,
  MediaDetail,
  ScrollableTabBar,
  StatusBar,
  VirtualMasonryGrid,
  type Tab,
} from '../media-browser/components';
import {
  useBackgroundMessaging,
  useCapturedFiles,
  useClassifyEvents,
  useClassifyQueue,
  useCombinedMedia,
  useHistoricalImages,
  useTheme,
  type CombinedMediaItem,
} from '../media-browser/hooks';
import {
  getConfig,
  getTagCounts,
  type TagCounts,
  type TagDefinition,
} from '../../shared/extension-runtime';
import {
  getSystemTagsForFile,
  getVisibleTabs,
  isUncategorized,
  parseTags,
} from '../../shared/tag-utils';
import { useSidePanelCapture } from './hooks/useSidePanelCapture';
import { appStyles as styles } from '../media-browser/styles';
import './sidepanel.css';

type ActiveTab = string;
type CaptureStreamFile = CombinedMediaItem & { filename?: string };
type CaptureClassifyData = { category: string; confidence: number; tags: string[] };

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [selectedItem, setSelectedItem] = useState<CombinedMediaItem | null>(null);
  const [userDefinedTags, setUserDefinedTags] = useState<TagDefinition[]>([]);
  const [tagCounts, setTagCounts] = useState<TagCounts>({ all: 0 });
  const [topContainerHeight, setTopContainerHeight] = useState(260);
  const theme = useTheme();
  const topContainerRef = useRef<HTMLDivElement>(null);

  const {
    events: backgroundEvents,
    vfsConnected,
    ollamaAvailable,
    clearEvents: clearBackgroundEvents,
    sendMessage,
  } = useBackgroundMessaging();

  const capture = useSidePanelCapture({ backgroundEvents });
  const capturedFiles = useCapturedFiles(backgroundEvents);
  const classifyStatus = useClassifyEvents(backgroundEvents);
  const classifyQueue = useClassifyQueue({ backgroundEvents });

  const loadTagCounts = useCallback(async () => {
    try {
      const counts = await getTagCounts();
      setTagCounts(counts);
    } catch (error) {
      console.error('Failed to load tag counts:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const config = await getConfig();
        setUserDefinedTags(config.userDefinedTags || []);
      } catch (error) {
        console.error('Failed to load config:', error);
      }
      await loadTagCounts();
    };

    loadData();
  }, [loadTagCounts]);

  useEffect(() => {
    const shouldRefreshTags = backgroundEvents.some(
      (event) => event.type === 'classify:complete' || event.type === 'file:classified'
    );
    if (shouldRefreshTags) {
      loadTagCounts();
    }
  }, [backgroundEvents, loadTagCounts]);

  const historicalImages = useHistoricalImages({
    limit: 50,
    autoLoad: true,
    tag: activeTab !== 'all' ? activeTab : undefined,
  });

  const handleDeleteItem = useCallback(
    async (hash: string) => {
      try {
        await sendMessage({ type: 'deleteFile', hash });
        // Close detail if we're deleting the currently selected item
        if (selectedItem?.hash === hash) {
          setSelectedItem(null);
        }
        // Rely on file:deleted event to update the list (no full refresh)
      } catch (err) {
        console.error('[App] Failed to delete item:', err);
      }
    },
    [sendMessage, selectedItem]
  );

  const combinedMedia = useCombinedMedia({
    historicalItems: historicalImages.items,
    backgroundEvents,
  });

  const themeClass = useMemo(() => theme.themeClass(styles.lightTheme, styles.darkTheme), [theme]);

  const visibleTabs = useMemo((): Tab[] => {
    return getVisibleTabs(userDefinedTags, tagCounts);
  }, [userDefinedTags, tagCounts]);

  const filteredMedia = useMemo(() => {
    if (activeTab === 'all') {
      return combinedMedia.items;
    }

    return combinedMedia.items.filter((item) => {
      const systemTags = getSystemTagsForFile(item.mimeType, false);
      if (systemTags.includes(activeTab)) return true;
      if (activeTab === 'starred') return false;

      const userTags = parseTags(item.tags);
      if (activeTab === 'uncategorized') {
        return isUncategorized(userTags.filter((tag) => !tag.startsWith('system:')));
      }

      return userTags.includes(activeTab);
    });
  }, [activeTab, combinedMedia.items]);

  const handleItemClick = useCallback((item: CombinedMediaItem) => {
    setSelectedItem(item);
  }, []);

  const handleCaptureItemClick = useCallback((file: CaptureStreamFile) => {
    setActiveTab(file.mimeType.startsWith('video/') ? 'videos' : 'images');
    setSelectedItem(file);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const handleOpenOptions = useCallback(() => {
    chrome.runtime.openOptionsPage();
  }, []);

  const handleClearEvents = useCallback(() => {
    clearBackgroundEvents();
  }, [clearBackgroundEvents]);

  // 动态计算顶部固定容器的高度
  useEffect(() => {
    const container = topContainerRef.current;
    if (!container) return;

    const updateHeight = () => {
      setTopContainerHeight(container.offsetHeight);
    };

    // 初始更新
    updateHeight();

    // 使用 ResizeObserver 监听高度变化
    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    resizeObserver.observe(container);

    // 也监听窗口大小变化
    window.addEventListener('resize', updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  return (
    <div className={`${styles.panel} ${themeClass}`}>
      <div ref={topContainerRef} className={styles.topFixedContainer}>
        <StatusBar
          serviceOnline={vfsConnected}
          isCapturing={capture.isCapturing}
          vfsConnected={vfsConnected}
          ollamaAvailable={ollamaAvailable}
          classifyQueue={classifyQueue.status}
          captureCount={capture.captureState?.captureCount ?? 0}
          failedCount={capture.captureState?.failedCount ?? 0}
          captureError={capture.error || capture.captureState?.error}
          onToggleCapture={capture.toggleCapture}
          onOpenOptions={handleOpenOptions}
          onClearEvents={handleClearEvents}
        />

        {capture.isCapturing && capturedFiles.length > 0 && (
          <CaptureStream
            files={capturedFiles.map((file) => ({
              ...file,
              classifyStatus: classifyStatus[file.hash]?.status,
              classifyData: classifyStatus[file.hash]?.data as CaptureClassifyData | undefined,
            }))}
            maxItems={10}
            onItemClick={handleCaptureItemClick}
          />
        )}

        <ClassifyProgressSection
          status={classifyQueue.status}
          loading={classifyQueue.loading}
          onStart={classifyQueue.startClassification}
          onPause={classifyQueue.pauseClassification}
          onRetryFailed={classifyQueue.retryFailed}
          onClearQueue={classifyQueue.clearQueue}
        />

        <ScrollableTabBar tabs={visibleTabs} activeTabId={activeTab} onTabChange={setActiveTab} />
      </div>

      <div className={styles.contentContainer} style={{ paddingTop: `${topContainerHeight}px` }}>
        <VirtualMasonryGrid
          items={filteredMedia}
          onLoadMore={historicalImages.loadMore}
          onItemClick={handleItemClick}
          onItemDelete={handleDeleteItem}
          hasMore={historicalImages.hasMore}
          loading={historicalImages.loading}
        />

        {selectedItem && (
          <MediaDetail
            item={selectedItem}
            onClose={handleCloseDetail}
            onDelete={handleDeleteItem}
          />
        )}
      </div>
    </div>
  );
}

export default App;
