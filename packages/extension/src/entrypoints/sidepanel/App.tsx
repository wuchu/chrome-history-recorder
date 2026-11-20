import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import StatusBar from '../media-browser/components/StatusBar';
import { useBackgroundMessaging } from '../media-browser/hooks/useBackgroundMessaging';
import { useTheme } from '../media-browser/hooks/useTheme';
import { appStyles } from '../media-browser/styles';
import { buildVfsFileUrl } from '../media-browser/utils/media';
import { useActiveTab } from './hooks/useActiveTab';
import { useCaptureSession } from './hooks/useCaptureSession';
import TabIdentity from './components/TabIdentity';
import SessionBanner from './components/SessionBanner';
import SessionMetrics from './components/SessionMetrics';
import SessionFeed from './components/SessionFeed';
import SessionEventLog from './components/SessionEventLog';
import SessionSummary from './components/SessionSummary';
import StartState from './components/StartState';
import ConfirmDialog from './components/ConfirmDialog';
import { summaryFromSession } from './utils';
import styles from './cockpit.module.css';
import './sidepanel.css';

function App() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { vfsConnected, ollamaAvailable } = useBackgroundMessaging({ collectEvents: false });
  const activeTab = useActiveTab();
  const capture = useCaptureSession();

  const [pendingStart, setPendingStart] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [topHeight, setTopHeight] = useState(0);
  const topContainerRef = useRef<HTMLDivElement>(null);

  const themeClass = useMemo(
    () => theme.themeClass(appStyles.lightTheme, appStyles.darkTheme),
    [theme]
  );
  const isDark = themeClass === appStyles.darkTheme;

  const session = capture.session;
  const sessionOnActiveTab = session?.tabId === activeTab.tabId && activeTab.tabId !== null;
  const isCapturing = session?.status === 'capturing';
  const showCockpit = Boolean(isCapturing && sessionOnActiveTab);
  const showBanner = Boolean(isCapturing && session && !sessionOnActiveTab);
  const showSummary = Boolean(!isCapturing && session && sessionOnActiveTab);

  const summary = useMemo(() => {
    if (!showSummary || !session) return null;
    const matching = capture.summary?.sessionId === session.id ? capture.summary : null;
    return summaryFromSession(matching, session);
  }, [capture.summary, session, showSummary]);

  const refreshSession = capture.refresh;
  useEffect(() => {
    void refreshSession();
  }, [activeTab.tabId, refreshSession]);

  useEffect(() => {
    const container = topContainerRef.current;
    if (!container) return;

    const updateHeight = () => setTopHeight(container.offsetHeight);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(container);
    window.addEventListener('resize', updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [showBanner, showCockpit]);

  const openOptions = useCallback((tab: 'library' | 'settings') => {
    void chrome.tabs.create({ url: chrome.runtime.getURL(`options.html#${tab}`) });
  }, []);

  const openItem = useCallback((hash: string) => {
    void chrome.tabs.create({ url: buildVfsFileUrl(hash) });
  }, []);

  const stopSession = useCallback(async () => {
    if (!session) return;
    setActionError(null);
    const ok = await capture.stop(session.tabId);
    if (!ok) setActionError(capture.error ?? 'Failed to stop capture session');
  }, [capture, session]);

  const startOnActiveTab = useCallback(async () => {
    if (activeTab.tabId === null || !activeTab.isSupported) return;
    setActionError(null);
    const ok = await capture.start(activeTab.tabId);
    if (!ok) setActionError(capture.error ?? 'Failed to start capture session');
  }, [activeTab, capture]);

  const requestStart = useCallback(async () => {
    if (activeTab.tabId === null || !activeTab.isSupported) return;
    if (isCapturing && session && !sessionOnActiveTab) {
      setPendingStart(true);
      return;
    }
    await startOnActiveTab();
  }, [activeTab, isCapturing, session, sessionOnActiveTab, startOnActiveTab]);

  const confirmStart = useCallback(async () => {
    if (!session || activeTab.tabId === null) return;
    const stopped = await capture.stop(session.tabId);
    if (!stopped) {
      setPendingStart(false);
      setActionError(capture.error ?? 'Failed to stop the current capture session');
      return;
    }
    await startOnActiveTab();
    setPendingStart(false);
  }, [activeTab.tabId, capture, session, startOnActiveTab]);

  const switchToSession = useCallback(async () => {
    if (!session) return;
    try {
      await chrome.tabs.update(session.tabId, { active: true });
      if (session.windowId !== undefined) {
        await chrome.windows.update(session.windowId, { focused: true });
      }
      await activeTab.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to switch to session tab');
    }
  }, [activeTab, session]);

  const handleToggleCapture = useCallback(() => {
    if (showCockpit) {
      void stopSession();
    } else {
      void requestStart();
    }
  }, [requestStart, showCockpit, stopSession]);

  return (
    <div
      className={`${appStyles.panel} ${themeClass} ${styles.app}`}
      data-theme={isDark ? 'dark' : 'light'}
    >
      <div ref={topContainerRef} className={styles.topFixed}>
        <TabIdentity tab={activeTab} />
        <StatusBar
          serviceOnline={vfsConnected}
          isCapturing={showCockpit}
          vfsConnected={vfsConnected}
          ollamaAvailable={ollamaAvailable}
          captureCount={session?.counters.saved ?? 0}
          failedCount={session?.counters.failed ?? 0}
          captureError={session?.error ?? capture.error ?? undefined}
          onToggleCapture={handleToggleCapture}
          onOpenOptions={() => openOptions('settings')}
          onClearEvents={() => void capture.clearLog()}
          disableCaptureToggle={!showCockpit && !vfsConnected}
        />

        {showBanner && session && (
          <SessionBanner
            session={session}
            busy={capture.busy}
            onSwitch={() => void switchToSession()}
            onStop={() => void stopSession()}
          />
        )}

        {showCockpit && session && (
          <SessionMetrics
            counters={session.counters}
            startedAt={session.startedAt}
            endedAt={session.endedAt}
            status={session.status}
          />
        )}

        {(actionError || capture.error) && (
          <div className={styles.errorBox} role="alert">
            {actionError || capture.error}
          </div>
        )}
      </div>

      <main className={styles.content} style={{ paddingTop: topHeight }}>
        {capture.loading && !session ? (
          <div className={styles.loading}>{t('cockpit.loading', '加载捕获会话…')}</div>
        ) : showCockpit && session ? (
          <>
            <SessionFeed items={session.recentItems} onOpenItem={openItem} />
            <SessionEventLog
              events={session.events}
              skippedCount={session.counters.skipped}
              failedCount={session.counters.failed}
              onClear={() => void capture.clearLog()}
              busy={capture.busy}
            />
          </>
        ) : showSummary && summary ? (
          <SessionSummary
            summary={summary}
            busy={capture.busy}
            onRestart={() => void requestStart()}
            onOpenLibrary={() => openOptions('library')}
          />
        ) : (
          <>
            {showBanner && (
              <div className={styles.bannerHint}>
                {t(
                  'cockpit.bannerHint',
                  '当前标签页没有捕获。如果在这里开始，会先停止另一个标签页的会话。'
                )}
              </div>
            )}
            <StartState tab={activeTab} busy={capture.busy} onStart={() => void requestStart()} />
          </>
        )}
      </main>

      <ConfirmDialog
        open={pendingStart}
        title={t('cockpit.confirm.title', '切换捕获会话？')}
        message={t('cockpit.confirm.message', {
          title: session?.tabTitle || session?.pageUrl || '',
          defaultValue: '当前正在捕获「{{title}}」。开始新会话会先停止它。',
        })}
        confirmLabel={t('cockpit.confirm.confirm', '停止并开始')}
        busy={capture.busy}
        onConfirm={() => void confirmStart()}
        onCancel={() => setPendingStart(false)}
      />
    </div>
  );
}

export default App;
