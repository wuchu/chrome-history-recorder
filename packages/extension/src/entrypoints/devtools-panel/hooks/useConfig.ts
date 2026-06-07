import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_VIDEO_TYPES,
  DEFAULT_STORAGE_PATH,
  DEFAULT_PROXY_ENDPOINT,
  DEFAULT_MIN_IMAGE_SIZE_KB,
  DEFAULT_MIN_VIDEO_SIZE_MB
} from '../constants';

type ThemeMode = 'auto' | 'light' | 'dark';

interface VideoTypes {
  mp4: boolean;
  webm: boolean;
  mov: boolean;
  avi: boolean;
}

interface UseConfigReturn {
  // State
  themeMode: ThemeMode;
  storagePath: string;
  proxyEndpoint: string;
  minImageSizeKB: number;
  minVideoSizeMB: number;
  videoTypes: VideoTypes;
  // Actions
  changeTheme: (mode: ThemeMode) => void;
  setStoragePath: (path: string) => void;
  setProxyEndpoint: (endpoint: string) => void;
  setMinImageSizeKB: (size: number) => void;
  setMinVideoSizeMB: (size: number) => void;
  setVideoTypes: (types: VideoTypes) => void;
  saveStoragePath: () => Promise<void>;
  saveProxyEndpoint: () => void;
  saveImageFilters: () => void;
  saveVideoFilters: () => void;
}

interface UseConfigOptions {
  onProxyEndpointChange?: (endpoint: string) => void;
  onMinImageSizeChange?: (size: number) => void;
  onMinVideoSizeChange?: (size: number) => void;
  onVideoTypesChange?: (types: string[]) => void;
}

/**
 * 配置管理 Hook
 * 语言自动跟随 Chrome DevTools，无需配置
 */
export function useConfig(options: UseConfigOptions = {}): UseConfigReturn {
  const { t } = useTranslation();

  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  const [storagePath, setStoragePath] = useState(DEFAULT_STORAGE_PATH);
  const [proxyEndpoint, setProxyEndpoint] = useState(DEFAULT_PROXY_ENDPOINT);
  const [minImageSizeKB, setMinImageSizeKB] = useState(DEFAULT_MIN_IMAGE_SIZE_KB);
  const [minVideoSizeMB, setMinVideoSizeMB] = useState(DEFAULT_MIN_VIDEO_SIZE_MB);
  const [videoTypes, setVideoTypes] = useState<VideoTypes>(DEFAULT_VIDEO_TYPES);

  // Load saved config
  useEffect(() => {
    const loadConfig = async () => {
      const saved = await chrome.storage.local.get([
        'storagePath', 'proxyEndpoint', 'minImageSizeKB',
        'minVideoSizeMB', 'enabledVideoTypes', 'themeMode'
      ]);

      if (saved.storagePath) setStoragePath(saved.storagePath);
      if (saved.proxyEndpoint) setProxyEndpoint(saved.proxyEndpoint);
      if (saved.minImageSizeKB) setMinImageSizeKB(saved.minImageSizeKB);
      if (saved.minVideoSizeMB) setMinVideoSizeMB(saved.minVideoSizeMB);
      if (saved.themeMode) setThemeMode(saved.themeMode);

      if (saved.enabledVideoTypes) {
        setVideoTypes({
          mp4: saved.enabledVideoTypes.includes('video/mp4'),
          webm: saved.enabledVideoTypes.includes('video/webm'),
          mov: saved.enabledVideoTypes.includes('video/quicktime'),
          avi: saved.enabledVideoTypes.includes('video/x-msvideo')
        });
      }
    };

    loadConfig();
  }, []);

  // Change theme
  const changeTheme = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    chrome.storage.local.set({ themeMode: mode });
  }, []);

  // Save storage path
  const saveStoragePath = useCallback(async () => {
    await chrome.storage.local.set({ storagePath });
    try {
      await fetch(`${proxyEndpoint}/config/storage-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: storagePath })
      });
      alert(t('alerts.pathSaved'));
    } catch {
      alert(t('alerts.connectionFailed'));
    }
  }, [storagePath, proxyEndpoint, t]);

  // Save proxy endpoint
  const saveProxyEndpoint = useCallback(() => {
    chrome.storage.local.set({ proxyEndpoint });
    options.onProxyEndpointChange?.(proxyEndpoint);
  }, [proxyEndpoint, options]);

  // Save image filters
  const saveImageFilters = useCallback(() => {
    options.onMinImageSizeChange?.(minImageSizeKB);
    chrome.storage.local.set({ minImageSizeKB });
  }, [minImageSizeKB, options]);

  // Save video filters
  const saveVideoFilters = useCallback(() => {
    const enabledTypes: string[] = [];
    if (videoTypes.mp4) enabledTypes.push('video/mp4');
    if (videoTypes.webm) enabledTypes.push('video/webm');
    if (videoTypes.mov) enabledTypes.push('video/quicktime');
    if (videoTypes.avi) enabledTypes.push('video/x-msvideo');

    options.onMinVideoSizeChange?.(minVideoSizeMB);
    options.onVideoTypesChange?.(enabledTypes);
    chrome.storage.local.set({
      minVideoSizeMB,
      enabledVideoTypes: enabledTypes
    });
  }, [videoTypes, minVideoSizeMB, options]);

  return {
    themeMode,
    storagePath,
    proxyEndpoint,
    minImageSizeKB,
    minVideoSizeMB,
    videoTypes,
    changeTheme,
    setStoragePath,
    setProxyEndpoint,
    setMinImageSizeKB,
    setMinVideoSizeMB,
    setVideoTypes,
    saveStoragePath,
    saveProxyEndpoint,
    saveImageFilters,
    saveVideoFilters
  };
}