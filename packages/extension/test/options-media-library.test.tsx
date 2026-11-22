// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { message, Modal } from 'antd';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from '../src/entrypoints/media-browser/locales/zh.json';
import MediaLibrary from '../src/entrypoints/options/components/MediaLibrary';

vi.mock('@virtuoso.dev/masonry', () => ({
  VirtuosoMasonry: ({
    data,
    ItemContent,
  }: {
    data: Array<unknown>;
    ItemContent: (props: { data: unknown; index: number }) => JSX.Element;
  }) => (
    <div data-testid="masonry">
      {data.map((item, index) => (
        <ItemContent key={index} data={item} index={index} />
      ))}
    </div>
  ),
}));

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'zh',
      resources: { zh: { translation: zh } },
      interpolation: { escapeValue: false },
    });
  }
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  // jsdom returns 0 for every element; the masonry grid waits for a real
  // container width before mounting.
  Element.prototype.getBoundingClientRect = () =>
    ({
      width: 900,
      height: 600,
      top: 0,
      left: 0,
      right: 900,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
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
});

const messageListeners: Array<(message: unknown) => void> = [];

beforeEach(() => {
  messageListeners.length = 0;
  sessionStorage.clear();

  const sendMessage = vi.fn(async (message: { type?: string; query?: { tag?: string } }) => {
    switch (message.type) {
      case 'listFiles':
        return {
          success: true,
          data: {
            items: [
              {
                hash: 'hash-one',
                mime_type: 'image/png',
                size: 100,
                captured_at: '2026-01-01T00:00:00.000Z',
                source_url: 'https://cdn.example.com/one.png',
              },
            ],
            total: 1,
            hasMore: false,
          },
        };
      case 'getTagCounts':
        return { success: true, data: { all: 2, image: 2, video: 0 } };
      case 'listTags':
        return { success: true, data: [] };
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
        addListener: vi.fn((listener: (message: unknown) => void) => {
          messageListeners.push(listener);
        }),
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
  vi.clearAllMocks();
});

describe('Options MediaLibrary', () => {
  it('loads global media and tag tabs', async () => {
    render(<MediaLibrary />);

    expect(await screen.findByText('📷 图片')).toBeTruthy();
    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'listFiles',
          query: expect.objectContaining({ limit: 50, offset: 0 }),
        })
      );
    });
    expect(await screen.findByTestId('masonry')).toBeTruthy();
    expect(document.querySelector('img[src*="hash-one"]')).toBeTruthy();
  });

  it('reloads by tag when a tag tab is selected', async () => {
    render(<MediaLibrary />);
    await screen.findByText('📷 图片');

    fireEvent.click(screen.getByText('📷 图片'));

    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'listFiles',
          query: expect.objectContaining({ tag: 'image', offset: 0 }),
        })
      );
    });
  });

  it('merges live captured media into the library', async () => {
    render(<MediaLibrary />);
    await screen.findByText('📷 图片');

    act(() => {
      for (const listener of messageListeners) {
        listener({
          type: 'file:captured',
          data: { hash: 'live-hash', mimeType: 'image/png', size: 50 },
          timestamp: '2026-01-01T00:00:01.000Z',
        });
      }
    });

    await waitFor(() => {
      expect(document.querySelector('img[src*="live-hash"]')).toBeTruthy();
    });
  });

  it('uses the tags:updated payload without refetching tag data', async () => {
    render(<MediaLibrary />);
    await screen.findByText('📷 图片');

    const sendMessage = vi.mocked(chrome.runtime.sendMessage);
    const tagRequests = () =>
      sendMessage.mock.calls.filter(([request]) => {
        const type = (request as { type?: string }).type;
        return type === 'getTagCounts' || type === 'listTags';
      }).length;
    const before = tagRequests();

    act(() => {
      for (const listener of messageListeners) {
        listener({
          type: 'tags:updated',
          data: {
            tags: [
              {
                id: 1,
                name: 'sunset',
                label: '🌅 日落',
                usage_count: 1,
                created_by: 'ai',
                is_pinned: 0,
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
              },
            ],
            counts: { all: 2, image: 2, sunset: 1 },
          },
          timestamp: '2026-01-01T00:00:01.000Z',
        });
      }
    });

    expect(await screen.findByText('#🌅 日落')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(tagRequests()).toBe(before);
  });

  it('searches through the library query', async () => {
    render(<MediaLibrary />);
    await screen.findByText('📷 图片');

    fireEvent.change(screen.getByPlaceholderText('搜索文件名 / 标签 / 来源'), {
      target: { value: 'beach' },
    });

    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'listFiles',
          query: expect.objectContaining({ q: 'beach' }),
        })
      );
    });
  });

  it('selects visible media for batch actions', async () => {
    render(<MediaLibrary />);
    await screen.findByText('📷 图片');

    fireEvent.click(screen.getByRole('button', { name: /选\s*择/ }));
    fireEvent.click(screen.getByLabelText('选择媒体'));

    expect(screen.getByText('已选 1 项')).toBeTruthy();
    expect(screen.getByRole('button', { name: '移入回收站' })).toBeTruthy();
  });

  it('shows an empty state when the library has no media', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(async (message: { type?: string }) => {
      if (message.type === 'listFiles') {
        return { success: true, data: { items: [], total: 0, hasMore: false } };
      }
      return { success: true };
    });

    render(<MediaLibrary />);
    expect(await screen.findByText('还没有捕获媒体')).toBeTruthy();
  });

  it('reports partial failures during batch trash', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      async (message: { type?: string; hash?: string }) => {
        if (message.type === 'get-status') {
          return { vfsConnected: true, ollamaAvailable: true };
        }
        if (message.type === 'listFiles') {
          return {
            success: true,
            data: {
              items: [
                {
                  hash: 'hash-one',
                  mime_type: 'image/png',
                  size: 10,
                  captured_at: '2026-01-01T00:00:00.000Z',
                },
                {
                  hash: 'hash-two',
                  mime_type: 'image/png',
                  size: 20,
                  captured_at: '2026-01-01T00:00:01.000Z',
                },
              ],
              total: 2,
              hasMore: false,
            },
          };
        }
        if (message.type === 'trashFile') {
          if (message.hash === 'hash-two') throw new Error('backend refused');
          return { success: true, data: { success: true } };
        }
        return { success: true };
      }
    );

    let confirmPromise: Promise<unknown> | undefined;
    const confirmSpy = vi.spyOn(Modal, 'confirm').mockImplementation((config) => {
      confirmPromise = Promise.resolve(config.onOk?.());
      return {} as ReturnType<typeof Modal.confirm>;
    });
    const warningSpy = vi.spyOn(message, 'warning').mockImplementation(() => undefined as never);

    try {
      render(<MediaLibrary />);
      await screen.findByText('📷 图片');

      fireEvent.click(screen.getByRole('button', { name: /选\s*择/ }));
      fireEvent.click(screen.getAllByLabelText('选择媒体')[0]);
      fireEvent.click(screen.getAllByLabelText('选择媒体')[1]);
      expect(screen.getByText('已选 2 项')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: '移入回收站' }));
      await confirmPromise;

      expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('1 项移入回收站失败'));
    } finally {
      confirmSpy.mockRestore();
      warningSpy.mockRestore();
    }
  });

  it('keeps the scroll position while toggling selection', async () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    document.documentElement.scrollTop = 240;

    try {
      render(<MediaLibrary />);
      await screen.findByText('📷 图片');

      fireEvent.click(screen.getByRole('button', { name: /选\s*择/ }));
      fireEvent.click(screen.getByLabelText('选择媒体'));
      fireEvent.click(screen.getByLabelText('选择媒体'));

      expect(document.documentElement.scrollTop).toBe(240);
      expect(scrollToSpy).not.toHaveBeenCalled();
    } finally {
      scrollToSpy.mockRestore();
      document.documentElement.scrollTop = 0;
    }
  });
});
