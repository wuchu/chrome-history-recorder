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
  it('loads global media and exposes a view switch', async () => {
    render(<MediaLibrary />);

    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'listFiles',
          query: expect.objectContaining({ limit: 50, offset: 0, status: 'active' }),
        })
      );
    });
    expect(await screen.findByTestId('masonry')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /媒体库/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /回收站/ })).toBeTruthy();
    expect(document.querySelector('img[src*="hash-one"]')).toBeTruthy();
  });

  it('filters by tag through the search query', async () => {
    render(<MediaLibrary />);
    await screen.findByTestId('masonry');

    fireEvent.change(screen.getByPlaceholderText('搜索文件名、标签、站点、备注…'), {
      target: { value: 'tag:image' },
    });

    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'listFiles',
          query: expect.objectContaining({ tags: ['image'], offset: 0 }),
        })
      );
    });
    expect(screen.queryByText('📷 图片')).toBeNull();
  });

  it('merges live captured media into the library', async () => {
    render(<MediaLibrary />);
    await screen.findByTestId('masonry');

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
    await screen.findByTestId('masonry');

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

    const input = screen.getByPlaceholderText('搜索文件名、标签、站点、备注…');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'tag:' } });

    expect(await screen.findByText(/🌅 日落/)).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(tagRequests()).toBe(before);
  });

  it('searches through the library query', async () => {
    render(<MediaLibrary />);
    await screen.findByTestId('masonry');

    fireEvent.change(screen.getByPlaceholderText('搜索文件名、标签、站点、备注…'), {
      target: { value: 'beach' },
    });

    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'listFiles',
          query: expect.objectContaining({ terms: ['beach'] }),
        })
      );
    });
  });

  it('selects visible media for batch actions', async () => {
    render(<MediaLibrary />);
    await screen.findByTestId('masonry');

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
      await screen.findByTestId('masonry');

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
      await screen.findByTestId('masonry');

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

  it('renders one search input instead of the old filter row', async () => {
    render(<MediaLibrary />);
    await screen.findByPlaceholderText('搜索文件名、标签、站点、备注…');

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByPlaceholderText('搜索文件名、标签、站点、备注…')).toBeTruthy();
    expect(screen.queryByPlaceholderText('类型')).toBeNull();
    expect(screen.queryByPlaceholderText('来源站点')).toBeNull();
    expect(screen.queryByPlaceholderText('分类状态')).toBeNull();
    expect(screen.queryByText('仅收藏')).toBeNull();
  });

  it('parses dimension tokens into the query and applied chips', async () => {
    render(<MediaLibrary />);
    await screen.findByTestId('masonry');

    fireEvent.change(screen.getByPlaceholderText('搜索文件名、标签、站点、备注…'), {
      target: { value: 'tag:cat site:example.com type:image' },
    });

    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'listFiles',
          query: expect.objectContaining({
            tags: ['cat'],
            tagMode: 'and',
            sourceDomains: ['example.com'],
            mimeType: 'image',
          }),
        })
      );
    });
    expect(await screen.findByText('标签: cat')).toBeTruthy();
    expect(screen.getByText('站点: example.com')).toBeTruthy();
    expect(screen.getByText('类型: 图片')).toBeTruthy();
  });

  it('removes one condition chip without clearing the others', async () => {
    render(<MediaLibrary />);
    await screen.findByTestId('masonry');

    fireEvent.change(screen.getByPlaceholderText('搜索文件名、标签、站点、备注…'), {
      target: { value: 'tag:cat site:example.com' },
    });
    const tagChip = await screen.findByText('标签: cat');
    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'listFiles',
          query: expect.objectContaining({ tags: ['cat'], sourceDomains: ['example.com'] }),
        })
      );
    });

    fireEvent.click(tagChip);

    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'listFiles',
          query: expect.objectContaining({
            tags: undefined,
            sourceDomains: ['example.com'],
          }),
        })
      );
    });
  });

  it('migrates the legacy filter object into a raw query', async () => {
    sessionStorage.setItem(
      'media-library-filters-v1',
      JSON.stringify({
        q: 'beach',
        mimeType: 'image',
        sourceDomain: 'example.com',
        datePreset: '7d',
        starred: true,
        classifyStatus: 'failed',
        tags: ['cat'],
        tagMode: 'and',
        sort: 'size:desc',
        activeTag: 'all',
      })
    );

    render(<MediaLibrary />);
    await screen.findByTestId('masonry');

    const input = screen.getByPlaceholderText('搜索文件名、标签、站点、备注…') as HTMLInputElement;
    expect(input.value).toContain('beach');
    expect(input.value).toContain('tag:cat');
    expect(input.value).toContain('type:image');
    expect(input.value).toContain('site:example.com');
    expect(input.value).toContain('date:7d');
    expect(input.value).toContain('starred');
    expect(input.value).toContain('status:failed');

    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'listFiles',
          query: expect.objectContaining({
            terms: ['beach'],
            tags: ['cat'],
            sourceDomains: ['example.com'],
            mimeType: 'image',
            starred: true,
            classifyStatus: 'failed',
            orderBy: 'size',
            order: 'desc',
          }),
        })
      );
    });

    expect(sessionStorage.getItem('media-library-filters-v1')).toBeNull();
    expect(sessionStorage.getItem('media-library-query-v1')).toContain('beach');
  });

  it('persists the raw query for the Options session', async () => {
    render(<MediaLibrary />);
    await screen.findByTestId('masonry');

    fireEvent.change(screen.getByPlaceholderText('搜索文件名、标签、站点、备注…'), {
      target: { value: 'beach' },
    });

    await waitFor(() => {
      expect(sessionStorage.getItem('media-library-query-v1')).toContain('beach');
    });
  });

  it('offers no-result recovery actions', async () => {
    const sendMessage = vi.mocked(chrome.runtime.sendMessage);
    const original = sendMessage.getMockImplementation()!;
    sendMessage.mockImplementation(async (message: { type?: string }) => {
      if (message.type === 'listFiles') {
        return { success: true, data: { items: [], total: 0, hasMore: false } };
      }
      return original(message);
    });

    render(<MediaLibrary />);
    expect(await screen.findByText('还没有捕获媒体')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('搜索文件名、标签、站点、备注…'), {
      target: { value: 'beach' },
    });
    expect(await screen.findByText('没有匹配的媒体')).toBeTruthy();
    expect(screen.getByRole('button', { name: '清除全部条件' })).toBeTruthy();
  });

  it('does not query until Chinese input composition ends', async () => {
    render(<MediaLibrary />);
    await screen.findByTestId('masonry');
    const input = screen.getByPlaceholderText('搜索文件名、标签、站点、备注…');

    const listQueries = () =>
      vi
        .mocked(chrome.runtime.sendMessage)
        .mock.calls.map(([request]) => request as { type?: string; query?: { terms?: string[] } })
        .filter((request) => request.type === 'listFiles')
        .map((request) => request.query?.terms);

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'mao' } });
    fireEvent.change(input, { target: { value: '猫' } });
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(listQueries()).not.toContainEqual(['猫']);
    expect(listQueries()).not.toContainEqual(['mao']);

    fireEvent.compositionEnd(input);
    await waitFor(() => expect(listQueries()).toContainEqual(['猫']));
  });
});
