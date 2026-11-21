// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ONE_SHOT_MENU_ID,
  handleOneShotContextMenuClick,
  registerOneShotContextMenu,
} from '../src/background/one-shot-context-menu';
import { saveContextMenuImage } from '../src/background/one-shot-capture';

vi.mock('../src/background/one-shot-capture', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/background/one-shot-capture')>();
  return {
    ...actual,
    saveContextMenuImage: vi.fn(),
  };
});

describe('one-shot context menu', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      contextMenus: {
        removeAll: vi.fn((callback: () => void) => callback()),
        create: vi.fn((_props: unknown, callback?: () => void) => callback?.()),
      },
      runtime: { lastError: undefined },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('registers the image menu idempotently', () => {
    registerOneShotContextMenu();

    expect(chrome.contextMenus.removeAll).toHaveBeenCalled();
    expect(chrome.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ONE_SHOT_MENU_ID,
        contexts: ['image'],
      }),
      expect.any(Function)
    );
  });

  it('saves the clicked image and reports the result', async () => {
    const saveMock = vi.mocked(saveContextMenuImage);
    saveMock.mockResolvedValue({ candidateId: 'context:1', saved: true, duplicate: false });
    const report = vi.fn();
    const dependencies = { saveMedia: vi.fn(), report };

    handleOneShotContextMenuClick(
      {
        menuItemId: ONE_SHOT_MENU_ID,
        srcUrl: 'https://example.com/image.png',
        pageUrl: 'https://example.com/page',
      } as chrome.contextMenus.OnClickData,
      { id: 7, url: 'https://example.com/page' } as chrome.tabs.Tab,
      dependencies
    );

    await vi.waitFor(() => expect(report).toHaveBeenCalled());
    expect(saveMock).toHaveBeenCalledWith(
      7,
      'https://example.com/image.png',
      'https://example.com/page',
      dependencies
    );
  });

  it('reports duplicate context-menu saves', async () => {
    const saveMock = vi.mocked(saveContextMenuImage);
    saveMock.mockResolvedValue({ candidateId: 'context:dup', saved: false, duplicate: true });
    const report = vi.fn();

    handleOneShotContextMenuClick(
      {
        menuItemId: ONE_SHOT_MENU_ID,
        srcUrl: 'https://example.com/image.png',
        pageUrl: 'https://example.com/page',
      } as chrome.contextMenus.OnClickData,
      { id: 7, url: 'https://example.com/page' } as chrome.tabs.Tab,
      { saveMedia: vi.fn(), report }
    );

    await vi.waitFor(() =>
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({ duplicate: true, saved: false })
      )
    );
  });

  it('ignores clicks without an image URL', () => {
    const saveMock = vi.mocked(saveContextMenuImage);
    const report = vi.fn();

    handleOneShotContextMenuClick(
      { menuItemId: ONE_SHOT_MENU_ID } as chrome.contextMenus.OnClickData,
      { id: 7 } as chrome.tabs.Tab,
      { saveMedia: vi.fn(), report }
    );

    expect(saveMock).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });
});
