import { useState, useEffect, useCallback } from 'react';

type ThemeMode = 'auto' | 'light' | 'dark';

interface UseThemeReturn {
  themeMode: ThemeMode;
  systemDark: boolean;
  themeClass: (lightClass: string, darkClass: string) => string;
  changeTheme: (mode: ThemeMode) => void;
}

/**
 * 主题管理 Hook
 * 规则: rerender-split-combined-hooks - 将相关状态逻辑抽离到独立 hook
 */
export function useTheme(): UseThemeReturn {
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  const [systemDark, setSystemDark] = useState(() => {
    // 规则: rerender-lazy-state-init - 使用函数初始化避免不必要的计算
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Theme class helper
  const themeClass = useCallback(
    (lightClass: string, darkClass: string) => {
      if (themeMode === 'auto') {
        return systemDark ? darkClass : lightClass;
      }
      return themeMode === 'dark' ? darkClass : lightClass;
    },
    [themeMode, systemDark]
  );

  // Change theme
  const changeTheme = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    chrome.storage.local.set({ themeMode: mode });
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const themeListener = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mediaQuery.addEventListener('change', themeListener);

    return () => {
      mediaQuery.removeEventListener('change', themeListener);
    };
  }, []);

  // Load saved theme
  useEffect(() => {
    chrome.storage.local.get('themeMode').then((saved) => {
      if (saved.themeMode) {
        setThemeMode(saved.themeMode as ThemeMode);
      }
    });
  }, []);

  return {
    themeMode,
    systemDark,
    themeClass,
    changeTheme
  };
}