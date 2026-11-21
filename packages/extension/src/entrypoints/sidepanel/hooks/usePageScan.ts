/**
 * Side Panel state for user-initiated page scans.
 *
 * One-shot capture is deliberately independent from the capture session: the
 * hook never reads or writes the session store.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  saveOneShotCandidate,
  scanPageMedia,
  type OneShotSaveResult,
  type PageScanResult,
} from '../../../shared/extension-runtime';

interface UsePageScanOptions {
  tabId: number | null;
  tabSupported: boolean;
  vfsConnected: boolean;
}

export interface PageScanProgress {
  completed: number;
  total: number;
}

export function usePageScan({ tabId, tabSupported, vfsConnected }: UsePageScanOptions) {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<PageScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<PageScanProgress | null>(null);
  const [results, setResults] = useState<OneShotSaveResult[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanRequestRef = useRef(0);

  const canScan = tabId !== null && tabSupported && vfsConnected;

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    const listener = (message: { type?: string; data?: OneShotSaveResult }) => {
      if (message.type !== 'one-shot:result' || !message.data) return;
      const result = message.data;
      if (result.saved) {
        showToast('已保存到媒体库');
      } else if (result.duplicate) {
        showToast('媒体已存在');
      } else if (result.skipped) {
        showToast(result.error ?? '已跳过');
      } else {
        showToast(`保存失败：${result.error ?? '未知错误'}`);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [showToast]);

  const startScan = useCallback(async () => {
    if (saving) return;
    if (tabId === null || !tabSupported) return;
    if (!vfsConnected) {
      setOpen(true);
      setError('VFS 未连接，请先启动本地服务并重连。');
      return;
    }

    setOpen(true);
    setScanning(true);
    setScan(null);
    setError(null);
    setResults([]);
    setSelected(new Set());

    const requestId = ++scanRequestRef.current;
    try {
      const result = await scanPageMedia(tabId);
      if (requestId !== scanRequestRef.current) return;
      setScan(result);
      setSelected(new Set(result.candidates.map((candidate) => candidate.id)));
    } catch (scanError) {
      if (requestId !== scanRequestRef.current) return;
      setError(scanError instanceof Error ? scanError.message : '扫描页面失败');
    } finally {
      if (requestId === scanRequestRef.current) {
        setScanning(false);
      }
    }
  }, [tabId, tabSupported, vfsConnected, saving]);

  const close = useCallback(() => {
    scanRequestRef.current += 1;
    setOpen(false);
    setScanning(false);
    setScan(null);
    setError(null);
    setSelected(new Set());
    setSaving(false);
    setProgress(null);
    setResults([]);
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!scan) return;
    setSelected(new Set(scan.candidates.map((candidate) => candidate.id)));
  }, [scan]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const saveSelected = useCallback(async () => {
    if (!scan || tabId === null || saving) return;
    const candidates = scan.candidates.filter((candidate) => selected.has(candidate.id));
    if (candidates.length === 0) return;

    setSaving(true);
    setResults([]);
    setProgress({ completed: 0, total: candidates.length });
    const collected: OneShotSaveResult[] = [];
    let index = 0;

    const worker = async () => {
      while (index < candidates.length) {
        const candidate = candidates[index];
        index += 1;
        try {
          const result = await saveOneShotCandidate(tabId, candidate);
          collected.push(result);
        } catch (saveError) {
          collected.push({
            candidateId: candidate.id,
            saved: false,
            duplicate: false,
            errorCode: 'unknown',
            error: saveError instanceof Error ? saveError.message : '保存失败',
          });
        }
        setProgress({ completed: collected.length, total: candidates.length });
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(3, candidates.length) }, worker));
      setResults([...collected]);
      const failedIds = new Set(
        collected
          .filter((result) => !result.saved && !result.duplicate && !result.skipped)
          .map((result) => result.candidateId)
      );
      setSelected(failedIds);
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }, [scan, tabId, selected, saving]);

  return {
    open,
    scanning,
    scan,
    error,
    selected,
    saving,
    progress,
    results,
    toast,
    canScan,
    startScan,
    close,
    toggle,
    selectAll,
    clearSelection,
    saveSelected,
  };
}

export default usePageScan;
