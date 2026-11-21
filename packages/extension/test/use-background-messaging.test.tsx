// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  MAX_BACKGROUND_EVENTS,
  useBackgroundMessaging,
} from '../src/entrypoints/media-browser/hooks/useBackgroundMessaging';

describe('useBackgroundMessaging event buffer', () => {
  let listeners: Array<(message: unknown) => void> = [];

  beforeEach(() => {
    listeners = [];
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: vi.fn(async (message: { type?: string }) => {
          if (message.type === 'get-status') {
            return { vfsConnected: true, ollamaAvailable: true };
          }
          return { success: true };
        }),
        onMessage: {
          addListener: vi.fn((listener: (message: unknown) => void) => {
            listeners.push(listener);
          }),
          removeListener: vi.fn((listener: (message: unknown) => void) => {
            listeners = listeners.filter((entry) => entry !== listener);
          }),
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('caps the diagnostic log while keeping the newest events', () => {
    const { result } = renderHook(() => useBackgroundMessaging());

    act(() => {
      for (let index = 0; index <= MAX_BACKGROUND_EVENTS; index += 1) {
        for (const listener of listeners) {
          listener({
            type: 'file:captured',
            data: { hash: `hash-${index}`, mimeType: 'image/png', size: index },
            timestamp: `t-${index}`,
          });
        }
      }
    });

    expect(result.current.events).toHaveLength(MAX_BACKGROUND_EVENTS);
    expect(result.current.events[0].timestamp).toBe('t-1');
    expect(result.current.events.at(-1)?.timestamp).toBe(`t-${MAX_BACKGROUND_EVENTS}`);
  });
});
