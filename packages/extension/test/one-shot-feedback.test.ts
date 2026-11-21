// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { reportOneShotResult } from '../src/background/one-shot-feedback';
import type { OneShotSaveResult } from '../src/shared/extension-runtime';

function dependencies() {
  return {
    sendMessage: vi.fn(async () => undefined),
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
    schedule: vi.fn((callback: () => void) => callback()),
  };
}

function result(overrides: Partial<OneShotSaveResult> = {}): OneShotSaveResult {
  return {
    candidateId: 'candidate-1',
    saved: true,
    duplicate: false,
    ...overrides,
  };
}

describe('one-shot feedback', () => {
  it('shows a success badge and clears it', () => {
    const deps = dependencies();
    reportOneShotResult(result(), deps);

    expect(deps.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'one-shot:result' })
    );
    expect(deps.setBadgeBackgroundColor).toHaveBeenCalledWith('#1677ff');
    expect(deps.setBadgeText).toHaveBeenNthCalledWith(1, '✓');
    expect(deps.setBadgeText).toHaveBeenNthCalledWith(2, '');
  });

  it('treats duplicates as a neutral success', () => {
    const deps = dependencies();
    reportOneShotResult(result({ saved: false, duplicate: true }), deps);

    expect(deps.setBadgeText).toHaveBeenNthCalledWith(1, '✓');
  });

  it('shows a failure badge', () => {
    const deps = dependencies();
    reportOneShotResult(result({ saved: false, duplicate: false, error: 'HTTP 404' }), deps);

    expect(deps.setBadgeBackgroundColor).toHaveBeenCalledWith('#ff4d4f');
    expect(deps.setBadgeText).toHaveBeenNthCalledWith(1, '!');
  });

  it('survives a missing Side Panel listener', () => {
    const deps = dependencies();
    deps.sendMessage.mockRejectedValueOnce(new Error('no receiver'));

    expect(() => reportOneShotResult(result(), deps)).not.toThrow();
  });
});
