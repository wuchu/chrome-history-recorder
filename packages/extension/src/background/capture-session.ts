/**
 * Capture Session singleton
 *
 * Initialized by the Background before the debugger capture controller. The
 * store's change callback relays snapshots to all extension UI contexts.
 */

import { CaptureSessionStore } from './capture-session-store';

let sessionStore: CaptureSessionStore | null = null;

export function initCaptureSessionStore(options: {
  onChange?: (snapshot: ReturnType<CaptureSessionStore['getSnapshot']>) => void;
}): CaptureSessionStore {
  sessionStore = new CaptureSessionStore({
    onChange: options.onChange,
  });
  return sessionStore;
}

export function getCaptureSessionStore(): CaptureSessionStore {
  if (!sessionStore) {
    throw new Error('CaptureSessionStore has not been initialized');
  }
  return sessionStore;
}

export function getExistingCaptureSessionStore(): CaptureSessionStore | null {
  return sessionStore;
}
