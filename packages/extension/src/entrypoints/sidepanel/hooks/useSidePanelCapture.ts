import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BackgroundEvent } from '../../media-browser/hooks/useBackgroundMessaging';

export interface CaptureState {
  tabId: number;
  isEnabled: boolean;
  status: 'idle' | 'capturing' | 'error';
  debuggerAttached: boolean;
  captureCount: number;
  skippedCount: number;
  failedCount: number;
  lastCaptureTime?: string;
  error?: string;
}

interface UseSidePanelCaptureOptions {
  backgroundEvents: BackgroundEvent[];
}

interface UseSidePanelCaptureReturn {
  activeTabId: number | null;
  captureState: CaptureState | null;
  isCapturing: boolean;
  loading: boolean;
  error: string | null;
  toggleCapture: () => Promise<void>;
  refreshCaptureState: () => Promise<void>;
}

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function requestCaptureState(tabId: number): Promise<CaptureState> {
  const response = await chrome.runtime.sendMessage({ type: 'capture:get-state', tabId });
  if (!response?.success) {
    throw new Error(response?.error || 'Failed to load capture state');
  }
  return response.data ?? response;
}

export function useSidePanelCapture({
  backgroundEvents,
}: UseSidePanelCaptureOptions): UseSidePanelCaptureReturn {
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [captureState, setCaptureState] = useState<CaptureState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCaptureState = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const tabId = await getActiveTabId();
      setActiveTabId(tabId);
      if (tabId === null) {
        setCaptureState(null);
        return;
      }

      const state = await requestCaptureState(tabId);
      setCaptureState(state);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh capture state';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleCapture = useCallback(async () => {
    const tabId = activeTabId ?? (await getActiveTabId());
    if (tabId === null) {
      setError('No active tab available for capture');
      return;
    }

    setActiveTabId(tabId);
    setLoading(true);
    setError(null);

    try {
      const type = captureState?.isEnabled ? 'capture:stop' : 'capture:start';
      const response = await chrome.runtime.sendMessage({ type, tabId });
      if (!response?.success) {
        throw new Error(response?.error || 'Capture request failed');
      }
      setCaptureState(response.data ?? response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Capture request failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeTabId, captureState?.isEnabled]);

  useEffect(() => {
    refreshCaptureState();
  }, [refreshCaptureState]);

  useEffect(() => {
    const listener = (activeInfo: chrome.tabs.TabActiveInfo) => {
      setActiveTabId(activeInfo.tabId);
      requestCaptureState(activeInfo.tabId)
        .then(setCaptureState)
        .catch((err) => {
          const message = err instanceof Error ? err.message : 'Failed to load tab capture state';
          setError(message);
        });
    };

    chrome.tabs.onActivated.addListener(listener);
    return () => chrome.tabs.onActivated.removeListener(listener);
  }, []);

  useEffect(() => {
    const latestStateEvent = [...backgroundEvents]
      .reverse()
      .find((event) => event.type === 'capture:state');

    if (!latestStateEvent) return;
    const state = latestStateEvent.data as CaptureState;
    if (state.tabId === activeTabId) {
      setCaptureState(state);
      setError(state.error ?? null);
    }
  }, [activeTabId, backgroundEvents]);

  return useMemo(
    () => ({
      activeTabId,
      captureState,
      isCapturing: Boolean(captureState?.isEnabled && captureState.status === 'capturing'),
      loading,
      error,
      toggleCapture,
      refreshCaptureState,
    }),
    [activeTabId, captureState, loading, error, toggleCapture, refreshCaptureState]
  );
}

export default useSidePanelCapture;
