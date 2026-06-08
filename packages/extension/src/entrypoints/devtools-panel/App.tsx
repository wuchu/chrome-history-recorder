import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import StatusBar from './components/StatusBar';
import StatsSection from './components/StatsSection';
import MediaTabs from './components/MediaTabs';
import MediaList from './components/MediaList';
import ConfigSection from './components/ConfigSection';
import { useNetworkListener } from './hooks/useNetworkListener';
import { useConfig } from './hooks/useConfig';
import {
  DEFAULT_VIDEO_TYPES,
  DEFAULT_PROXY_ENDPOINT,
  DEFAULT_MIN_IMAGE_SIZE_KB,
  DEFAULT_MIN_VIDEO_SIZE_MB,
} from './constants';
import styles from './App.module.css';

type ActiveTab = 'images' | 'videos';

/**
 * 工具函数 - 提取到模块级别避免每次渲染创建新函数
 * 规则: rendering-hoist-jsx - 提取静态内容
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function truncateUrl(url: string): string {
  return url.length > 50 ? url.substring(0, 50) + '...' : url;
}

function App() {
  const { t: _t } = useTranslation();

  // 规则: rerender-split-combined-hooks - 简单状态保持在组件内
  const [activeTab, setActiveTab] = useState<ActiveTab>('images');
  const [systemDark, setSystemDark] = useState(() => {
    // 规则: rerender-lazy-state-init - 使用函数初始化避免不必要的计算
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // 配置状态 - 使用 hook 管理
  const [proxyEndpoint, setProxyEndpoint] = useState(DEFAULT_PROXY_ENDPOINT);
  const [minImageSizeKB, setMinImageSizeKB] = useState(DEFAULT_MIN_IMAGE_SIZE_KB);
  const [minVideoSizeMB, setMinVideoSizeMB] = useState(DEFAULT_MIN_VIDEO_SIZE_MB);
  const [videoTypes, _setVideoTypes] = useState(DEFAULT_VIDEO_TYPES);

  // 网络监听器 hook
  const {
    serviceOnline,
    isCapturing,
    images,
    videos,
    imageStats,
    videoStats,
    toggleCapture,
    clearImages,
    clearVideos,
    checkServiceHealth,
  } = useNetworkListener({
    proxyEndpoint,
    minImageSizeKB,
    minVideoSizeMB,
    videoTypes,
  });

  // 配置管理 hook
  const config = useConfig({
    onProxyEndpointChange: (endpoint) => setProxyEndpoint(endpoint),
    onMinImageSizeChange: (size) => setMinImageSizeKB(size),
    onMinVideoSizeChange: (size) => setMinVideoSizeMB(size),
    onVideoTypesChange: (_types) => {
      // Network listener 内部会处理这个
    },
  });

  // Theme class - 使用 useMemo 缓存计算结果
  const themeClass = useMemo(() => {
    if (config.themeMode === 'auto') {
      return systemDark ? styles.darkTheme : styles.lightTheme;
    }
    return config.themeMode === 'dark' ? styles.darkTheme : styles.lightTheme;
  }, [config.themeMode, systemDark]);

  // 稳定的回调函数 - 规则: rerender-functional-setstate
  const memoizedFormatSize = useCallback(formatSize, []);
  const memoizedTruncateUrl = useCallback(truncateUrl, []);

  // Health check interval
  useEffect(() => {
    const healthInterval = setInterval(checkServiceHealth, 5000);

    // Theme change listener
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const themeListener = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mediaQuery.addEventListener('change', themeListener);

    return () => {
      clearInterval(healthInterval);
      mediaQuery.removeEventListener('change', themeListener);
    };
  }, [checkServiceHealth]);

  return (
    <div className={`${styles.panel} ${themeClass}`}>
      <StatusBar
        serviceOnline={serviceOnline}
        isCapturing={isCapturing}
        onToggleCapture={toggleCapture}
      />

      <StatsSection
        imageStats={imageStats}
        videoStats={videoStats}
        formatSize={memoizedFormatSize}
      />

      <MediaTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        imageCount={images.length}
        videoCount={videos.length}
      />

      <MediaList
        activeTab={activeTab}
        images={images}
        videos={videos}
        formatSize={memoizedFormatSize}
        truncateUrl={memoizedTruncateUrl}
        onClearImages={clearImages}
        onClearVideos={clearVideos}
      />

      <ConfigSection
        themeMode={config.themeMode}
        storagePath={config.storagePath}
        proxyEndpoint={config.proxyEndpoint}
        minImageSizeKB={config.minImageSizeKB}
        minVideoSizeMB={config.minVideoSizeMB}
        videoTypes={config.videoTypes}
        serviceOnline={serviceOnline}
        onThemeChange={config.changeTheme}
        onStoragePathChange={config.setStoragePath}
        onProxyEndpointChange={config.setProxyEndpoint}
        onMinImageSizeChange={config.setMinImageSizeKB}
        onMinVideoSizeChange={config.setMinVideoSizeMB}
        onVideoTypesChange={config.setVideoTypes}
        onSaveStoragePath={config.saveStoragePath}
        onSaveProxyEndpoint={config.saveProxyEndpoint}
        onSaveImageFilters={config.saveImageFilters}
        onSaveVideoFilters={config.saveVideoFilters}
      />
    </div>
  );
}

export default App;
