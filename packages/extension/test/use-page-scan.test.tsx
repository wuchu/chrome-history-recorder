// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { usePageScan } from '../src/entrypoints/sidepanel/hooks/usePageScan';
import * as runtime from '../src/shared/extension-runtime';

vi.mock('../src/shared/extension-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/shared/extension-runtime')>();
  return {
    ...actual,
    scanPageMedia: vi.fn(),
    saveOneShotCandidate: vi.fn(),
  };
});

const scan = {
  candidates: [
    {
      id: 'img:one',
      kind: 'img' as const,
      url: 'https://example.com/one.png',
      pageUrl: 'https://example.com/page',
    },
    {
      id: 'img:two',
      kind: 'img' as const,
      url: 'https://example.com/two.png',
      pageUrl: 'https://example.com/page',
    },
  ],
  totalFound: 2,
  skippedSmall: 0,
  skippedSvg: 0,
  skippedIframes: 0,
  capped: 0,
};

describe('usePageScan', () => {
  let messageListeners: Array<(message: unknown) => void> = [];

  beforeEach(() => {
    messageListeners = [];
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener: vi.fn((listener: (message: unknown) => void) => {
            messageListeners.push(listener);
          }),
          removeListener: vi.fn((listener: (message: unknown) => void) => {
            messageListeners = messageListeners.filter((entry) => entry !== listener);
          }),
        },
      },
    });
    vi.mocked(runtime.scanPageMedia).mockResolvedValue(scan);
    vi.mocked(runtime.saveOneShotCandidate).mockImplementation(async (_tabId, candidate) => ({
      candidateId: candidate.id,
      saved: candidate.id === 'img:one',
      duplicate: candidate.id === 'img:two',
    }));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('scans, selects all candidates, and saves the selection', async () => {
    const { result } = renderHook(() =>
      usePageScan({ tabId: 3, tabSupported: true, vfsConnected: true })
    );

    await act(async () => {
      await result.current.startScan();
    });

    expect(result.current.open).toBe(true);
    expect(result.current.scan?.candidates).toHaveLength(2);
    expect(result.current.selected.size).toBe(2);

    await act(async () => {
      await result.current.saveSelected();
    });

    expect(result.current.results).toHaveLength(2);
    expect(result.current.results.filter((entry) => entry.saved)).toHaveLength(1);
    expect(result.current.results.filter((entry) => entry.duplicate)).toHaveLength(1);
    expect(result.current.selected.size).toBe(0);
  });

  it('blocks scanning when VFS is disconnected', async () => {
    const { result } = renderHook(() =>
      usePageScan({ tabId: 3, tabSupported: true, vfsConnected: false })
    );

    await act(async () => {
      await result.current.startScan();
    });

    expect(result.current.open).toBe(true);
    expect(result.current.error).toContain('VFS');
    expect(runtime.scanPageMedia).not.toHaveBeenCalled();
  });

  it('shows context-menu save feedback without touching a session', async () => {
    const { result } = renderHook(() =>
      usePageScan({ tabId: 3, tabSupported: true, vfsConnected: true })
    );

    act(() => {
      for (const listener of messageListeners) {
        listener({
          type: 'one-shot:result',
          data: { candidateId: 'context', saved: true, duplicate: false },
        });
      }
    });

    await waitFor(() => expect(result.current.toast).toBe('已保存到媒体库'));
  });
});
