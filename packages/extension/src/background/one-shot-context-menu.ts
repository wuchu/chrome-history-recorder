/**
 * Image context menu for one-shot saves.
 */

import { saveContextMenuImage, type OneShotSaveDependencies } from './one-shot-capture';
import type { OneShotSaveResult } from '../shared/extension-runtime';

export const ONE_SHOT_MENU_ID = 'one-shot-save-image';

export interface OneShotContextMenuDependencies extends OneShotSaveDependencies {
  report: (result: OneShotSaveResult) => Promise<void> | void;
}

/**
 * Register the image menu idempotently. removeAll is used so repeated service
 * worker starts do not hit duplicate-id errors.
 */
export function registerOneShotContextMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: ONE_SHOT_MENU_ID,
        title: '保存图片到媒体库',
        contexts: ['image'],
      },
      () => {
        void chrome.runtime.lastError;
      }
    );
  });
}

export function handleOneShotContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab: chrome.tabs.Tab | undefined,
  dependencies: OneShotContextMenuDependencies
): void {
  if (info.menuItemId !== ONE_SHOT_MENU_ID) return;
  if (!info.srcUrl || typeof tab?.id !== 'number') return;

  void (async () => {
    const result = await saveContextMenuImage(
      tab.id as number,
      info.srcUrl as string,
      info.pageUrl || tab?.url || '',
      dependencies
    );
    await dependencies.report(result);
  })();
}
