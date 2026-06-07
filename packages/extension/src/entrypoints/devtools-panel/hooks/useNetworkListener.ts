import { useState, useEffect, useCallback, useRef } from 'react';
import { NetworkListener, MediaRequest } from '../../../utils/networkListener';

interface ImageStats {
  captured: number;
  skipped: number;
  failed: number;
  size: number;
}

interface VideoStats {
  captured: number;
  skipped: number;
  failed: number;
  size: number;
}

interface UseNetworkListenerOptions {
  proxyEndpoint: string;
  minImageSizeKB: number;
  minVideoSizeMB: number;
  videoTypes: {
    mp4: boolean;
    webm: boolean;
    mov: boolean;
    avi: boolean;
  };
}

interface UseNetworkListenerReturn {
  serviceOnline: boolean;
  isCapturing: boolean;
  images: MediaRequest[];
  videos: MediaRequest[];
  imageStats: ImageStats;
  videoStats: VideoStats;
  toggleCapture: () => Promise<void>;
  clearImages: () => void;
  clearVideos: () => void;
  checkServiceHealth: () => Promise<void>;
}

export function useNetworkListener({
  proxyEndpoint,
  minImageSizeKB,
  minVideoSizeMB,
  videoTypes
}: UseNetworkListenerOptions): UseNetworkListenerReturn {
  const [serviceOnline, setIsOnline] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [images, setImages] = useState<MediaRequest[]>([]);
  const [videos, setVideos] = useState<MediaRequest[]>([]);
  const [imageStats, setImageStats] = useState<ImageStats>({
    captured: 0,
    skipped: 0,
    failed: 0,
    size: 0
  });
  const [videoStats, setVideoStats] = useState<VideoStats>({
    captured: 0,
    skipped: 0,
    failed: 0,
    size: 0
  });

  const networkListenerRef = useRef<NetworkListener | null>(null);
  const currentTabIdRef = useRef<number | null>(null);

  // Check service health
  const checkServiceHealth = useCallback(async () => {
    try {
      const response = await fetch(`${proxyEndpoint}/health`);
      setIsOnline(response.ok);
    } catch {
      setIsOnline(false);
    }
  }, [proxyEndpoint]);

  // Update stats from listener
  const updateStats = useCallback(() => {
    if (!networkListenerRef.current) return;

    const stats = networkListenerRef.current.getStats();
    setImageStats({
      captured: stats.capturedImageCount,
      skipped: stats.skippedSvgCount,
      failed: stats.failedImageCount,
      size: stats.totalImageSize
    });
    setImages(networkListenerRef.current.getCapturedImages());

    setVideoStats({
      captured: stats.capturedVideoCount,
      skipped: stats.skippedVideoCount,
      failed: stats.failedVideoCount,
      size: stats.totalVideoSize
    });
    setVideos(networkListenerRef.current.getCapturedVideos());
  }, []);

  // Toggle capture
  const toggleCapture = useCallback(async () => {
    if (!networkListenerRef.current) return;

    setIsCapturing(prev => !prev);

    if (!isCapturing) {
      networkListenerRef.current.startListening();
      console.log('Started capturing media');
    } else {
      networkListenerRef.current.stopListening();
      console.log('Stopped capturing media');
    }

    if (currentTabIdRef.current) {
      await chrome.runtime.sendMessage({
        type: 'setCaptureEnabled',
        tabId: currentTabIdRef.current,
        enabled: !isCapturing
      });
    }
  }, [isCapturing]);

  // Clear functions
  const clearImages = useCallback(() => {
    if (!networkListenerRef.current) return;
    networkListenerRef.current.clearImages();
    updateStats();
  }, [updateStats]);

  const clearVideos = useCallback(() => {
    if (!networkListenerRef.current) return;
    networkListenerRef.current.clearVideos();
    updateStats();
  }, [updateStats]);

  // Initialize network listener
  useEffect(() => {
    const initListener = async () => {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTabIdRef.current = tab.id ?? null;

      // Initialize network listener
      networkListenerRef.current = new NetworkListener();
      networkListenerRef.current.setProxyEndpoint(proxyEndpoint);
      networkListenerRef.current.setMinFileSize(minImageSizeKB * 1024);
      networkListenerRef.current.setMinVideoSize(minVideoSizeMB * 1024 * 1024);

      const enabledVideoTypes: string[] = [];
      if (videoTypes.mp4) enabledVideoTypes.push('video/mp4');
      if (videoTypes.webm) enabledVideoTypes.push('video/webm');
      if (videoTypes.mov) enabledVideoTypes.push('video/quicktime');
      if (videoTypes.avi) enabledVideoTypes.push('video/x-msvideo');
      networkListenerRef.current.setEnabledVideoTypes(enabledVideoTypes);

      // Notify background
      if (currentTabIdRef.current) {
        await chrome.runtime.sendMessage({
          type: 'devToolsOpened',
          tabId: currentTabIdRef.current
        });
      }

      console.log('Media Recorder panel initialized');
    };

    initListener();

    // Stats update interval
    const statsInterval = setInterval(updateStats, 1000);

    // Initial health check
    checkServiceHealth();

    return () => {
      clearInterval(statsInterval);

      if (networkListenerRef.current && isCapturing) {
        networkListenerRef.current.stopListening();
      }

      if (currentTabIdRef.current) {
        chrome.runtime.sendMessage({
          type: 'devToolsClosed',
          tabId: currentTabIdRef.current
        });
      }
    };
  }, []); // 只在挂载时运行一次

  // Update listener config when props change
  useEffect(() => {
    if (networkListenerRef.current) {
      networkListenerRef.current.setProxyEndpoint(proxyEndpoint);
    }
  }, [proxyEndpoint]);

  useEffect(() => {
    if (networkListenerRef.current) {
      networkListenerRef.current.setMinFileSize(minImageSizeKB * 1024);
    }
  }, [minImageSizeKB]);

  useEffect(() => {
    if (networkListenerRef.current) {
      networkListenerRef.current.setMinVideoSize(minVideoSizeMB * 1024 * 1024);
    }
  }, [minVideoSizeMB]);

  useEffect(() => {
    if (networkListenerRef.current) {
      const enabledVideoTypes: string[] = [];
      if (videoTypes.mp4) enabledVideoTypes.push('video/mp4');
      if (videoTypes.webm) enabledVideoTypes.push('video/webm');
      if (videoTypes.mov) enabledVideoTypes.push('video/quicktime');
      if (videoTypes.avi) enabledVideoTypes.push('video/x-msvideo');
      networkListenerRef.current.setEnabledVideoTypes(enabledVideoTypes);
    }
  }, [videoTypes]);

  return {
    serviceOnline,
    isCapturing,
    images,
    videos,
    imageStats,
    videoStats,
    toggleCapture,
    clearImages,
    clearVideos,
    checkServiceHealth
  };
}