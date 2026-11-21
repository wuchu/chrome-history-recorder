// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import type { CombinedMediaItem } from '../src/entrypoints/media-browser/hooks/useCombinedMedia';
import {
  buildExportEntryName,
  exportMedia,
  ExportLimitError,
  extensionForItem,
  MAX_EXPORT_FILES,
  sanitizeExportName,
  type ExportProgress,
} from '../src/entrypoints/options/media-export';

function item(overrides: Partial<CombinedMediaItem> = {}): CombinedMediaItem {
  return {
    hash: 'hash-one',
    mimeType: 'image/png',
    size: 100,
    capturedAt: '2026-01-01T00:00:00.000Z',
    ai_filename: 'cat',
    ...overrides,
  };
}

function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe('media export helpers', () => {
  it('sanitizes path separators, control characters, and reserved names', () => {
    expect(sanitizeExportName('../../evil\nname')).toBe('_.._evilname');
    expect(sanitizeExportName('CON')).toBe('_CON');
    expect(sanitizeExportName('   ')).toBe('media');
  });

  it('derives real extensions from MIME types', () => {
    expect(extensionForItem({ mimeType: 'image/jpeg' })).toBe('jpg');
    expect(extensionForItem({ mimeType: 'video/webm' })).toBe('webm');
    expect(extensionForItem({ mimeType: 'image/x-weird' })).toBe('xweird');
  });

  it('adds collision suffixes', () => {
    const used = new Map<string, number>();
    expect(buildExportEntryName(item(), used)).toBe('cat.png');
    expect(buildExportEntryName(item({ hash: 'hash-two' }), used)).toBe('cat (2).png');
    expect(buildExportEntryName(item({ hash: 'hash-three' }), used)).toBe('cat (3).png');
  });

  it('falls back to the hash and avoids duplicating an existing extension', () => {
    const used = new Map<string, number>();
    expect(buildExportEntryName(item({ ai_filename: null }), used)).toBe('hash-one.png');
    expect(buildExportEntryName(item({ ai_filename: 'cat.png' }), used)).toBe('cat.png');
  });

  it('rejects an empty selection', async () => {
    await expect(exportMedia([])).rejects.toThrow(/at least one/i);
  });

  it('rejects selections over the file cap', async () => {
    const items = Array.from({ length: MAX_EXPORT_FILES + 1 }, (_, index) =>
      item({ hash: `hash-${index}` })
    );
    await expect(exportMedia(items)).rejects.toBeInstanceOf(ExportLimitError);
  });

  it('rejects selections over the size cap', async () => {
    const items = [item({ size: 2 * 1024 * 1024 * 1024 })];
    await expect(exportMedia(items)).rejects.toBeInstanceOf(ExportLimitError);
  });

  it('writes originals and a manifest into the archive', async () => {
    let capturedBlob: Blob | null = null;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:test';
    });
    URL.revokeObjectURL = vi.fn();

    const download = vi.fn(
      (_options: chrome.downloads.DownloadOptions, callback?: (id?: number) => void) => {
        callback?.(1);
      }
    );
    vi.stubGlobal('chrome', {
      runtime: { lastError: undefined },
      downloads: { download },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }))
    );

    const progress: ExportProgress[] = [];
    try {
      const result = await exportMedia([item(), item({ hash: 'hash-two', ai_filename: 'cat' })], {
        onProgress: (entry) => progress.push(entry),
      });

      expect(result.exported).toBe(2);
      expect(result.failures).toHaveLength(0);
      expect(download).toHaveBeenCalled();
      expect(progress.at(-1)?.completed).toBe(2);

      expect(capturedBlob).toBeTruthy();
      const bytes = await blobBytes(capturedBlob!);
      const entries = unzipSync(bytes);
      expect(Object.keys(entries)).toEqual(
        expect.arrayContaining(['cat.png', 'cat (2).png', 'metadata.json'])
      );

      const manifest = JSON.parse(strFromU8(entries['metadata.json'])) as {
        items: Array<{ hash: string; fileName: string }>;
      };
      expect(manifest.items).toHaveLength(2);
      expect(manifest.items.map((entry) => entry.fileName)).toEqual(['cat.png', 'cat (2).png']);
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      vi.unstubAllGlobals();
    }
  });

  it('skips missing blobs and reports them in the manifest', async () => {
    let capturedBlob: Blob | null = null;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:test';
    });
    URL.revokeObjectURL = vi.fn();

    const download = vi.fn(
      (_options: chrome.downloads.DownloadOptions, callback?: (id?: number) => void) => {
        callback?.(1);
      }
    );
    vi.stubGlobal('chrome', {
      runtime: { lastError: undefined },
      downloads: { download },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('hash-missing')) {
          return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
        }
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        };
      })
    );

    try {
      const result = await exportMedia([
        item(),
        item({ hash: 'hash-missing', ai_filename: 'missing' }),
      ]);

      expect(result.exported).toBe(1);
      expect(result.failures).toEqual([{ hash: 'hash-missing', reason: 'HTTP 404' }]);

      const bytes = await blobBytes(capturedBlob!);
      const entries = unzipSync(bytes);
      const manifest = JSON.parse(strFromU8(entries['metadata.json'])) as {
        items: unknown[];
        failures: unknown[];
      };
      expect(manifest.items).toHaveLength(1);
      expect(manifest.failures).toHaveLength(1);
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      vi.unstubAllGlobals();
    }
  });

  it('does not save an archive when cancelled', async () => {
    const download = vi.fn();
    vi.stubGlobal('chrome', {
      runtime: { lastError: undefined },
      downloads: { download },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }))
    );

    const controller = new AbortController();
    controller.abort();

    try {
      await expect(exportMedia([item()], { signal: controller.signal })).rejects.toThrow(/cancel/i);
      expect(download).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
