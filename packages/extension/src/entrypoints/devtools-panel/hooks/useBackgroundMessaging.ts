/**
 * Background Messaging Hook for Extension
 *
 * Manages communication with Background Service Worker via chrome.runtime.sendMessage.
 * Replaces WebSocket-based event handling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { buildVfsFileUrl, buildVfsThumbnailUrl } from '../utils/media';

/**
 * Background event structure
 */
export interface BackgroundEvent {
  type: string;
  data: unknown;
  timestamp: string;
}

/**
 * useBackgroundMessaging options
 */
interface UseBackgroundMessagingOptions {
  onEvent?: (event: BackgroundEvent) => void;
}

/**
 * useBackgroundMessaging return type
 */
interface UseBackgroundMessagingReturn {
  events: BackgroundEvent[];
  vfsConnected: boolean;
  ollamaAvailable: boolean;
  sendMessage: (message: unknown) => Promise<unknown>;
  clearEvents: () => void;
}

/**
 * Hook for handling Background Service Worker events
 */
export function useBackgroundMessaging({
  onEvent,
}: UseBackgroundMessagingOptions = {}): UseBackgroundMessagingReturn {
  const [events, setEvents] = useState<BackgroundEvent[]>([]);
  const [vfsConnected, setVfsConnected] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);

  const mountedRef = useRef(true);

  /**
   * Send message to Background
   */
  const sendMessage = useCallback(async (message: unknown): Promise<unknown> => {
    try {
      const response = await chrome.runtime.sendMessage(message);
      return response;
    } catch (error) {
      console.error('[BackgroundMessaging] Send failed:', error);
      throw error;
    }
  }, []);

  /**
   * Clear events array
   */
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  /**
   * Handle incoming messages from Background
   */
  useEffect(() => {
    mountedRef.current = true;

    const handleMessage = (message: BackgroundEvent) => {
      if (!mountedRef.current) return;

      console.log('[BackgroundMessaging] Event received:', message.type, message.data);

      // Update connection status
      if (message.type === 'vfs:connected') {
        setVfsConnected(true);
      } else if (message.type === 'vfs:disconnected') {
        setVfsConnected(false);
      } else if (message.type === 'ollama:status') {
        const data = message.data as { available: boolean };
        setOllamaAvailable(data.available);
      }

      // Add to events array (skip connection status events)
      if (message.type !== 'vfs:connected' && message.type !== 'vfs:disconnected' && message.type !== 'ollama:status') {
        setEvents((prev) => [...prev, message]);
      }

      // Call custom handler
      if (onEvent) {
        onEvent(message);
      }
    };

    // Listen for messages from Background
    chrome.runtime.onMessage.addListener(handleMessage);

    // Request initial status from Background
    sendMessage({ type: 'get-status' })
      .then((response) => {
        if (!mountedRef.current || !response) return;

        const status = response as { vfsConnected?: boolean; ollamaAvailable?: boolean };
        console.log('[BackgroundMessaging] Initial status received:', status);

        if (typeof status.vfsConnected === 'boolean') {
          setVfsConnected(status.vfsConnected);
        }
        if (typeof status.ollamaAvailable === 'boolean') {
          setOllamaAvailable(status.ollamaAvailable);
        }
      })
      .catch(() => {
        console.log('[BackgroundMessaging] Background not ready yet');
      });

    return () => {
      mountedRef.current = false;
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [onEvent, sendMessage]);

  return {
    events,
    vfsConnected,
    ollamaAvailable,
    sendMessage,
    clearEvents,
  };
}

/**
 * Hook for handling classification events from Background
 */
export function useClassifyEvents(events: BackgroundEvent[]) {
  const [classifyStatus, setClassifyStatus] = useState<
    Record<string, { status: 'pending' | 'processing' | 'completed' | 'failed'; data?: unknown }>
  >({});

  useEffect(() => {
    for (const event of events) {
      if (event.type === 'classify:queued') {
        const data = event.data as { hash: string };
        setClassifyStatus((prev) => ({
          ...prev,
          [data.hash]: { status: 'pending' },
        }));
      } else if (event.type === 'classify:started') {
        const data = event.data as { hash: string };
        setClassifyStatus((prev) => ({
          ...prev,
          [data.hash]: { status: 'processing' },
        }));
      } else if (event.type === 'classify:complete' || event.type === 'file:classified') {
        const data = event.data as { hash: string; category: string; confidence?: number };
        setClassifyStatus((prev) => ({
          ...prev,
          [data.hash]: { status: 'completed', data },
        }));
      } else if (event.type === 'classify:failed') {
        const data = event.data as { hash: string; error: string };
        setClassifyStatus((prev) => ({
          ...prev,
          [data.hash]: { status: 'failed', data },
        }));
      }
    }
  }, [events]);

  return classifyStatus;
}

/**
 * Hook for handling file captured events from Background
 */
export function useCapturedFiles(events: BackgroundEvent[]) {
  const [capturedFiles, setCapturedFiles] = useState<
    Array<{
      hash: string;
      filename: string;
      mimeType: string;
      size: number;
      url: string;
      thumbnailUrl: string;
      capturedAt: string;
    }>
  >([]);

  useEffect(() => {
    for (const event of events) {
      if (event.type === 'file:captured') {
        const data = event.data as {
          hash: string;
          mimeType?: string;
          mime_type?: string;
          size: number;
          capturedAt?: string;
          captured_at?: string;
        };
        const mimeType = data.mimeType ?? data.mime_type;

        if (!data.hash || !mimeType) {
          console.warn('[BackgroundMessaging] Ignoring invalid file:captured event:', data);
          return;
        }

        setCapturedFiles((prev) => {
          // Avoid duplicates
          if (prev.some((f) => f.hash === data.hash)) {
            return prev;
          }
          return [
            {
              hash: data.hash,
              filename: data.hash, // Will be updated when classified
              mimeType,
              size: data.size,
              url: buildVfsFileUrl(data.hash),
              thumbnailUrl: buildVfsThumbnailUrl(data.hash),
              capturedAt: data.capturedAt ?? data.captured_at ?? new Date().toISOString(),
            },
            ...prev,
          ];
        });
      }
    }
  }, [events]);

  return capturedFiles;
}

export default useBackgroundMessaging;