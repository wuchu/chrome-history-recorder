/**
 * User-facing feedback for one-shot saves.
 *
 * The Side Panel receives `one-shot:result` when it is open; the action badge
 * is the fallback when it is closed.
 */

import type { OneShotSaveResult } from '../shared/extension-runtime';

export interface OneShotFeedbackDependencies {
  sendMessage?: (message: unknown) => Promise<unknown> | void;
  setBadgeText?: (text: string) => void;
  setBadgeBackgroundColor?: (color: string) => void;
  schedule?: (callback: () => void, delayMs: number) => void;
}

export function reportOneShotResult(
  result: OneShotSaveResult,
  dependencies: OneShotFeedbackDependencies
): void {
  const success = result.saved || result.duplicate;

  try {
    const pending = dependencies.sendMessage?.({ type: 'one-shot:result', data: result });
    if (pending && typeof pending.catch === 'function') {
      void pending.catch(() => undefined);
    }
  } catch {
    // No receiver; the badge is the fallback.
  }

  dependencies.setBadgeBackgroundColor?.(success ? '#1677ff' : '#ff4d4f');
  dependencies.setBadgeText?.(success ? '✓' : '!');
  dependencies.schedule?.(() => dependencies.setBadgeText?.(''), 2500);
}

export const defaultOneShotFeedback: OneShotFeedbackDependencies = {
  sendMessage: (message) => chrome.runtime.sendMessage(message).catch(() => undefined),
  setBadgeText: (text) => {
    void chrome.action.setBadgeText({ text });
  },
  setBadgeBackgroundColor: (color) => {
    void chrome.action.setBadgeBackgroundColor({ color });
  },
  schedule: (callback, delayMs) => {
    setTimeout(callback, delayMs);
  },
};
