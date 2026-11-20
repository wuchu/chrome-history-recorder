/**
 * Tracks the tab that owns the Side Panel's window focus.
 *
 * The Side Panel is associated with a browser window, so the active tab is
 * resolved with `currentWindow: true`. Updates arrive from tab activation,
 * in-tab navigation, and window focus changes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ActiveTabInfo {
  tabId: number | null;
  windowId: number | null;
  title: string;
  url: string;
  favIconUrl?: string;
  hostname: string;
  isSupported: boolean;
  loading: boolean;
}

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:', 'file:']);
const UNSUPPORTED_HOSTS = new Set(['chromewebstore.google.com', 'chrome.google.com']);

function normalizeHostname(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:') return '本地文件';
    return parsed.hostname || parsed.protocol.replace(':', '');
  } catch {
    return '';
  }
}

export function isCapturableUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!SUPPORTED_PROTOCOLS.has(parsed.protocol)) return false;
    if (UNSUPPORTED_HOSTS.has(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function readActiveTab(): Promise<ActiveTabInfo> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    return {
      tabId: null,
      windowId: null,
      title: '',
      url: '',
      hostname: '',
      isSupported: false,
      loading: false,
    };
  }

  const url = tab.url ?? '';
  return {
    tabId: tab.id ?? null,
    windowId: tab.windowId ?? null,
    title: tab.title ?? normalizeHostname(url),
    url,
    favIconUrl: tab.favIconUrl,
    hostname: normalizeHostname(url),
    isSupported: isCapturableUrl(url),
    loading: false,
  };
}

export function useActiveTab(): ActiveTabInfo & { refresh: () => Promise<void> } {
  const [tab, setTab] = useState<ActiveTabInfo>({
    tabId: null,
    windowId: null,
    title: '',
    url: '',
    hostname: '',
    isSupported: false,
    loading: true,
  });
  const tabIdRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await readActiveTab();
      tabIdRef.current = next.tabId;
      setTab(next);
    } catch {
      setTab((previous) => ({ ...previous, loading: false }));
    }
  }, []);

  useEffect(() => {
    void refresh();

    const handleActivated = () => {
      void refresh();
    };
    const handleUpdated = (tabId: number) => {
      if (tabId === tabIdRef.current) {
        void refresh();
      }
    };
    const handleWindowFocus = () => {
      void refresh();
    };

    chrome.tabs.onActivated.addListener(handleActivated);
    chrome.tabs.onUpdated.addListener(handleUpdated);
    chrome.windows.onFocusChanged.addListener(handleWindowFocus);

    return () => {
      chrome.tabs.onActivated.removeListener(handleActivated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      chrome.windows.onFocusChanged.removeListener(handleWindowFocus);
    };
  }, [refresh]);

  return { ...tab, refresh };
}

export default useActiveTab;
