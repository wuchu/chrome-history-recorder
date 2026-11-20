// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
});
