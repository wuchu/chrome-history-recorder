/**
 * Service Retry Hook
 *
 * Provides retry functionality for VFS WebSocket and Ollama connections.
 */

import { useState, useCallback } from 'react';

interface UseServiceRetryReturn {
  retrying: { vfs: boolean; ollama: boolean };
  retryVFS: () => Promise<void>;
  retryOllama: () => Promise<void>;
  checkVFS: () => Promise<boolean>;
  checkOllama: () => Promise<boolean>;
}

export function useServiceRetry(): UseServiceRetryReturn {
  const [retrying, setRetrying] = useState({ vfs: false, ollama: false });

  const checkVFS = useCallback(async (): Promise<boolean> => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'isVFSConnected' });
      return response?.connected ?? false;
    } catch (error) {
      console.error('[ServiceRetry] VFS check failed:', error);
      return false;
    }
  }, []);

  const checkOllama = useCallback(async (): Promise<boolean> => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'isOllamaAvailable' });
      return response?.available ?? false;
    } catch (error) {
      console.error('[ServiceRetry] Ollama check failed:', error);
      return false;
    }
  }, []);

  const retryVFS = useCallback(async (): Promise<void> => {
    setRetrying((prev) => ({ ...prev, vfs: true }));
    try {
      // Request Background to reconnect VFS WebSocket
      await chrome.runtime.sendMessage({ type: 'reconnectVFS' });
      // Wait a bit and check status
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await checkVFS();
    } catch (error) {
      console.error('[ServiceRetry] VFS retry failed:', error);
    } finally {
      setRetrying((prev) => ({ ...prev, vfs: false }));
    }
  }, [checkVFS]);

  const retryOllama = useCallback(async (): Promise<void> => {
    setRetrying((prev) => ({ ...prev, ollama: true }));
    try {
      // Request Background to check Ollama health
      await chrome.runtime.sendMessage({ type: 'checkOllamaHealth' });
      // Wait a bit and check status
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await checkOllama();
    } catch (error) {
      console.error('[ServiceRetry] Ollama retry failed:', error);
    } finally {
      setRetrying((prev) => ({ ...prev, ollama: false }));
    }
  }, [checkOllama]);

  return {
    retrying,
    retryVFS,
    retryOllama,
    checkVFS,
    checkOllama,
  };
}

export default useServiceRetry;