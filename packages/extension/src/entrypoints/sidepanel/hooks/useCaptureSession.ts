/**
 * Capture session state for the Side Panel.
 *
 * The session is global (one active session across tabs); this hook fetches
 * the snapshot, keeps it current from Background broadcasts, and exposes
 * start/stop/clear actions with loading and error state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearCaptureSessionLog,
  getCaptureSession,
  startCapture,
  stopCapture,
  type CaptureSession,
  type CaptureSessionSnapshot,
  type SessionSummary,
} from '../../../shared/extension-runtime';

interface UseCaptureSessionReturn {
  session: CaptureSession | null;
  summary: SessionSummary | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  start: (tabId: number) => Promise<boolean>;
  stop: (tabId: number) => Promise<boolean>;
  clearLog: () => Promise<boolean>;
}

export function useCaptureSession(): UseCaptureSessionReturn {
  const [snapshot, setSnapshot] = useState<CaptureSessionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await getCaptureSession();
      if (!mountedRef.current) return;
      setSnapshot(next);
      setError(null);
    } catch (refreshError) {
      if (!mountedRef.current) return;
      setError(
        refreshError instanceof Error ? refreshError.message : 'Failed to load capture session'
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    const listener = (message: { type?: string; data?: unknown }) => {
      if (message.type !== 'capture:session' || !message.data) return;
      if (!mountedRef.current) return;
      setSnapshot(message.data as CaptureSessionSnapshot);
      setLoading(false);
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      mountedRef.current = false;
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [refresh]);

  const start = useCallback(
    async (tabId: number) => {
      setBusy(true);
      setError(null);
      try {
        await startCapture(tabId);
        await refresh();
        return true;
      } catch (startError) {
        setError(
          startError instanceof Error ? startError.message : 'Failed to start capture session'
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const stop = useCallback(
    async (tabId: number) => {
      setBusy(true);
      setError(null);
      try {
        await stopCapture(tabId);
        await refresh();
        return true;
      } catch (stopError) {
        setError(stopError instanceof Error ? stopError.message : 'Failed to stop capture session');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const clearLog = useCallback(async () => {
    try {
      await clearCaptureSessionLog();
      await refresh();
      return true;
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : 'Failed to clear event log');
      return false;
    }
  }, [refresh]);

  return {
    session: snapshot?.session ?? null,
    summary: snapshot?.summary ?? null,
    loading,
    busy,
    error,
    refresh,
    start,
    stop,
    clearLog,
  };
}

export default useCaptureSession;
