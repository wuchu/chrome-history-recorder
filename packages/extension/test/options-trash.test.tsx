// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from '../src/entrypoints/media-browser/locales/zh.json';
import TrashPage from '../src/entrypoints/options/components/TrashPage';

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

let sendMessage: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sendMessage = vi.fn(async (message: { type?: string }) => {
    switch (message.type) {
      case 'listFiles':
        return {
          success: true,
          data: {
            items: [
              {
                hash: 'trash-one',
                mime_type: 'image/png',
                size: 100,
                captured_at: '2026-01-01T00:00:00.000Z',
                deleted_at: '2026-02-01T00:00:00.000Z',
              },
            ],
            total: 1,
            hasMore: false,
          },
        };
      case 'getStats':
        return { success: true, data: { trashFiles: 1, trashSize: 2048 } };
      case 'get-status':
        return { vfsConnected: true, ollamaAvailable: true };
      default:
        return { success: true, count: 1 };
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
  vi.clearAllMocks();
});

describe('Options TrashPage', () => {
  it('loads only trashed media', async () => {
    render(<TrashPage />);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'listFiles',
          query: expect.objectContaining({ status: 'trashed', offset: 0 }),
        })
      );
    });
    expect(await screen.findByTestId('masonry')).toBeTruthy();
    expect(screen.getByText('回收站')).toBeTruthy();
    expect(screen.getByText('共 1 个')).toBeTruthy();
  });

  it('restores a file from the detail view', async () => {
    render(<TrashPage />);
    await screen.findByTestId('masonry');

    fireEvent.click(screen.getByLabelText('打开媒体'));
    fireEvent.click(await screen.findByTitle('恢复'));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: 'restoreFile', hash: 'trash-one' });
    });
  });

  it('offers restore-all and empty-trash controls', async () => {
    render(<TrashPage />);
    await screen.findByTestId('masonry');

    expect(screen.getByRole('button', { name: '恢复全部' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '清空回收站' })).toBeTruthy();
  });
});
