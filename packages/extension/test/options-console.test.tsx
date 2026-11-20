// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from '../src/entrypoints/media-browser/locales/zh.json';
import MediaDetail from '../src/entrypoints/media-browser/components/MediaDetail';
import OverviewTab from '../src/entrypoints/options/components/OverviewTab';

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'zh',
      resources: { zh: { translation: zh } },
      interpolation: { escapeValue: false },
    });
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  const sendMessage = vi.fn(async (message: { type?: string }) => {
    switch (message.type) {
      case 'listFiles':
        return { success: true, data: { items: [], total: 0, hasMore: false } };
      case 'getStats':
        return {
          success: true,
          data: {
            totalFiles: 4,
            totalSize: 2048,
            images: 3,
            videos: 1,
            byCategory: { uncategorized: 2 },
          },
        };
      case 'capture:get-session':
        return {
          success: true,
          data: {
            session: {
              id: 'session-1',
              tabId: 1,
              tabTitle: 'Example page',
              pageUrl: 'https://example.com/page',
              origin: 'https://example.com',
              startedAt: '2026-01-01T00:00:00.000Z',
              status: 'capturing',
              counters: {
                saved: 3,
                duplicate: 0,
                skipped: 0,
                failed: 0,
                bytesSaved: 2048,
                imagesSaved: 3,
                videosSaved: 0,
                aiPending: 0,
                aiProcessing: 0,
                aiCompleted: 3,
                aiFailed: 0,
                videosQueued: 0,
                videosDownloading: 0,
              },
              recentItems: [],
              events: [],
              savedHashes: [],
              aiStatuses: {},
            },
            summary: null,
          },
        };
      case 'get-status':
        return { vfsConnected: true, ollamaAvailable: true };
      default:
        return { success: true };
    }
  });

  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage,
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Options OverviewTab', () => {
  it('shows the active session read-only', async () => {
    render(
      <OverviewTab
        serviceStatus={{ vfsConnected: true, ollamaAvailable: true }}
        queueStatus={{ pending: 1, processing: 0, completed: 4, failed: 0, total: 5 }}
        onRefresh={() => {}}
        onOpenLibrary={() => {}}
      />
    );

    expect(await screen.findByText('Example page')).toBeTruthy();
    expect(screen.getByText('捕获中')).toBeTruthy();
    expect(screen.queryByText('开始捕获')).toBeNull();
    expect(screen.queryByText('停止捕获')).toBeNull();
  });
});

describe('MediaDetail metadata and actions', () => {
  const item = {
    hash: 'abc123',
    mimeType: 'image/png',
    size: 2048,
    capturedAt: '2026-01-01T00:00:00.000Z',
    sourceUrl: 'https://cdn.example.com/image.png',
    tags: ['cat', 'system:image'],
    model_used: 'llava:7b',
    confidence: 0.9,
  };

  it('renders metadata including the source URL', () => {
    render(<MediaDetail item={item} onClose={() => {}} />);

    expect(screen.getByText('https://cdn.example.com/image.png')).toBeTruthy();
    expect(screen.getAllByText('abc123').length).toBeGreaterThan(0);
    expect(screen.getByText('image/png')).toBeTruthy();
    expect(screen.getByText('2.0 KB')).toBeTruthy();
    expect(screen.getByText('cat · system:image')).toBeTruthy();
    expect(screen.getByText('llava:7b')).toBeTruthy();
  });

  it('requests deletion and AI requeue from the toolbar', () => {
    const onDeleteRequest = vi.fn();
    const onRefreshTask = vi.fn();
    render(
      <MediaDetail
        item={item}
        onClose={() => {}}
        onDeleteRequest={onDeleteRequest}
        onRefreshTask={onRefreshTask}
      />
    );

    fireEvent.click(screen.getByTitle('重新分类'));
    fireEvent.click(screen.getByTitle('重新命名'));
    fireEvent.click(screen.getByTitle('删除'));

    expect(onRefreshTask).toHaveBeenNthCalledWith(1, 'classify', 'abc123');
    expect(onRefreshTask).toHaveBeenNthCalledWith(2, 'rename', 'abc123');
    expect(onDeleteRequest).toHaveBeenCalledWith('abc123');
  });
});
