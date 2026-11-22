// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  saveOneShotCandidate,
  scanTabForMedia,
  type OneShotSaveDependencies,
} from '../src/background/one-shot-capture';
import { getCaptureSessionStore } from '../src/background/capture-session';

vi.mock('../src/background/capture-session', () => ({
  getCaptureSessionStore: vi.fn(),
}));
import type { OneShotMediaCandidate } from '../src/shared/extension-runtime';
import { UploadMediaError } from '../src/background/http-upload';

function candidate(overrides: Partial<OneShotMediaCandidate> = {}): OneShotMediaCandidate {
  return {
    id: 'img:https://example.com/a.png',
    kind: 'img',
    url: 'https://example.com/a.png',
    pageUrl: 'https://example.com/page',
    ...overrides,
  };
}

function bytes(count: number): Uint8Array {
  return new Uint8Array(count).fill(7);
}

function base64(bytesValue: Uint8Array): string {
  let binary = '';
  for (const byte of bytesValue) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function deps(
  result: { hash: string; duplicate: boolean } = { hash: 'hash-1', duplicate: false }
): OneShotSaveDependencies & { saveMedia: ReturnType<typeof vi.fn> } {
  const saveMedia = vi.fn(async () => result);
  return { saveMedia };
}

describe('saveOneShotCandidate', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      scripting: {
        executeScript: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('saves an http image through the ingest path', async () => {
    const bytesValue = bytes(2048);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: (name: string) => (name === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => bytesValue.buffer,
      }))
    );
    const dependencies = deps();

    const result = await saveOneShotCandidate(1, candidate(), dependencies);

    expect(result.saved).toBe(true);
    expect(result.hash).toBe('hash-1');
    expect(dependencies.saveMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        mimeType: 'image/png',
        url: 'https://example.com/a.png',
        buffer: expect.any(Uint8Array),
      })
    );
    expect(getCaptureSessionStore).not.toHaveBeenCalled();
  });

  it('reports a duplicate without claiming a new save', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => bytes(2048).buffer,
      }))
    );

    const result = await saveOneShotCandidate(
      1,
      candidate(),
      deps({ hash: 'hash-1', duplicate: true })
    );

    expect(result.saved).toBe(false);
    expect(result.duplicate).toBe(true);
  });

  it('rejects non-image responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => 'text/html' },
        arrayBuffer: async () => bytes(2048).buffer,
      }))
    );
    const dependencies = deps();

    const result = await saveOneShotCandidate(1, candidate(), dependencies);

    expect(result.saved).toBe(false);
    expect(result.errorCode).toBe('unsupported-mime');
    expect(dependencies.saveMedia).not.toHaveBeenCalled();
  });

  it('rejects images over the HTTP size limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => ({ byteLength: 51 * 1024 * 1024 }),
      }))
    );

    const result = await saveOneShotCandidate(1, candidate(), deps());
    expect(result.errorCode).toBe('too-large');
  });

  it('decodes a data URL', async () => {
    const dataUrl = `data:image/png;base64,${base64(bytes(2048))}`;
    const dependencies = deps();

    const result = await saveOneShotCandidate(
      1,
      candidate({ id: 'data:1', url: dataUrl }),
      dependencies
    );

    expect(result.saved).toBe(true);
    expect(dependencies.saveMedia).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'image/png' })
    );
  });

  it('skips images smaller than 1 KB', async () => {
    const dataUrl = `data:image/png;base64,${base64(bytes(10))}`;
    const result = await saveOneShotCandidate(
      1,
      candidate({ id: 'data:small', url: dataUrl }),
      deps()
    );

    expect(result.skipped).toBe(true);
    expect(result.errorCode).toBe('too-small');
  });

  it('fetches a blob URL in the page MAIN world', async () => {
    const dataUrl = `data:image/png;base64,${base64(bytes(2048))}`;
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([
      { result: { dataUrl, mimeType: 'image/png' } },
    ] as never);
    const dependencies = deps();

    const result = await saveOneShotCandidate(
      1,
      candidate({ id: 'blob:1', url: 'blob:https://example.com/123' }),
      dependencies
    );

    expect(result.saved).toBe(true);
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ world: 'MAIN' })
    );
  });

  it('reports an expired blob', async () => {
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([
      { result: { error: 'revoked' } },
    ] as never);

    const result = await saveOneShotCandidate(
      1,
      candidate({ id: 'blob:expired', url: 'blob:https://example.com/expired' }),
      deps()
    );

    expect(result.errorCode).toBe('expired-blob');
  });

  it('reports a timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('Aborted', 'AbortError');
      })
    );

    const result = await saveOneShotCandidate(1, candidate(), deps());
    expect(result.errorCode).toBe('timeout');
  });

  it('reports a disconnected VFS', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => bytes(2048).buffer,
      }))
    );
    const saveMedia = vi.fn(async () => {
      throw new Error('VFS WebSocket Client not connected');
    });

    const result = await saveOneShotCandidate(1, candidate(), { saveMedia });
    expect(result.errorCode).toBe('vfs-disconnected');
  });

  it('maps upload failures to one-shot reasons', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => bytes(2048).buffer,
      }))
    );
    const saveMedia = vi.fn(async () => {
      throw new UploadMediaError('network', 'VFS upload failed: Failed to fetch');
    });
    const result = await saveOneShotCandidate(1, candidate(), { saveMedia });
    expect(result.errorCode).toBe('vfs-disconnected');

    const tooLarge = vi.fn(async () => {
      throw new UploadMediaError('http', 'too large', 413);
    });
    expect((await saveOneShotCandidate(1, candidate(), { saveMedia: tooLarge })).errorCode).toBe(
      'too-large'
    );

    const badMime = vi.fn(async () => {
      throw new UploadMediaError('http', 'unsupported', 415);
    });
    expect((await saveOneShotCandidate(1, candidate(), { saveMedia: badMime })).errorCode).toBe(
      'unsupported-mime'
    );
  });

  it('injects the scanner and returns its result', async () => {
    const scanResult = {
      candidates: [],
      totalFound: 0,
      skippedSmall: 0,
      skippedSvg: 0,
      skippedIframes: 0,
      capped: 0,
    };
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([{ result: scanResult }] as never);

    const result = await scanTabForMedia(9);

    expect(result).toEqual(scanResult);
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 9 } })
    );
  });

  it('reports a restricted page when injection fails', async () => {
    vi.mocked(chrome.scripting.executeScript).mockRejectedValue(
      new Error('Cannot access chrome:// pages')
    );

    await expect(scanTabForMedia(9)).rejects.toThrow(/chrome/);
  });
});
