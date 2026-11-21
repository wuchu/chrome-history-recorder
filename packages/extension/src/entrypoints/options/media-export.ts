/**
 * Client-side media export.
 *
 * The Options page already has the metadata for the selected items and can
 * read originals over the local HTTP endpoint, so the archive is assembled in
 * the extension. Files are stored (not re-compressed) because media is already
 * compressed.
 */

import { Zip, ZipPassThrough, strToU8 } from 'fflate';
import { buildVfsFileUrl } from '../media-browser/utils/media';
import type { CombinedMediaItem } from '../media-browser/hooks/useCombinedMedia';

export const MAX_EXPORT_FILES = 500;
export const MAX_EXPORT_BYTES = 1024 * 1024 * 1024;

const WINDOWS_RESERVED_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/ogg': 'ogv',
  'video/x-matroska': 'mkv',
};

export interface ExportProgress {
  completed: number;
  total: number;
  currentName: string;
}

export interface ExportFailure {
  hash: string;
  reason: string;
}

export interface ExportResult {
  fileName: string;
  exported: number;
  failures: ExportFailure[];
}

export class ExportLimitError extends Error {}
export class ExportCancelledError extends Error {}

export interface ExportOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ExportProgress) => void;
}

function sanitizeName(raw: string): string {
  let name = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '');
  if (!name) name = 'media';
  if (WINDOWS_RESERVED_NAMES.has(name.toLowerCase())) name = `_${name}`;
  return name.slice(0, 120) || 'media';
}

/** Exported for tests and reuse by the detail view. */
export function sanitizeExportName(raw: string): string {
  return sanitizeName(raw);
}

/** Exported for tests: extension derived from the MIME type. */
export function extensionForItem(item: Pick<CombinedMediaItem, 'mimeType'>): string {
  return extensionFor(item as CombinedMediaItem);
}

function extensionFor(item: CombinedMediaItem): string {
  const mapped = MIME_EXTENSIONS[item.mimeType.toLowerCase()];
  if (mapped) return mapped;
  const subtype = item.mimeType.split('/')[1]?.split(';')[0] ?? '';
  return (
    subtype
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase()
      .slice(0, 10) || 'bin'
  );
}

function uniqueEntryName(item: CombinedMediaItem, used: Map<string, number>): string {
  const extension = extensionFor(item);
  let base = sanitizeName(item.ai_filename || item.hash);
  const suffix = `.${extension}`;
  if (base.toLowerCase().endsWith(suffix)) {
    base = base.slice(0, -suffix.length) || item.hash;
  }
  const key = `${base}${suffix}`.toLowerCase();
  const count = (used.get(key) ?? 0) + 1;
  used.set(key, count);
  return count === 1 ? `${base}${suffix}` : `${base} (${count})${suffix}`;
}

/** Exported for tests: collision-safe zip entry name. */
export function buildExportEntryName(item: CombinedMediaItem, used: Map<string, number>): string {
  return uniqueEntryName(item, used);
}

function manifestRecord(item: CombinedMediaItem, fileName: string) {
  return {
    hash: item.hash,
    fileName,
    mimeType: item.mimeType,
    size: item.size,
    capturedAt: item.capturedAt,
    sourceUrl: item.sourceUrl ?? null,
    sourceDomain: item.sourceDomain ?? null,
    tags: Array.isArray(item.tags) ? item.tags : [],
    notes: item.notes ?? null,
    starred: item.isStarred === true,
    aiFilename: item.ai_filename ?? null,
    confidence: item.confidence ?? null,
    modelUsed: item.model_used ?? null,
    classifiedAt: item.classified_at ?? null,
  };
}

function saveBlob(blob: Blob, fileName: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  return new Promise<void>((resolve, reject) => {
    chrome.downloads.download({ url, filename: fileName, saveAs: true }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  }).finally(() => {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });
}

function archiveName(now: Date): string {
  const date = now.toISOString().slice(0, 10);
  return `media-export-${date}.zip`;
}

/**
 * Export the selected items to a zip and save it through the browser.
 */
export async function exportMedia(
  items: CombinedMediaItem[],
  options: ExportOptions = {}
): Promise<ExportResult> {
  if (items.length === 0) {
    throw new Error('Select at least one item to export.');
  }
  if (items.length > MAX_EXPORT_FILES) {
    throw new ExportLimitError(
      `This export would include ${items.length} items; the limit is ${MAX_EXPORT_FILES}. Narrow the selection.`
    );
  }
  const estimatedBytes = items.reduce((sum, item) => sum + (item.size || 0), 0);
  if (estimatedBytes > MAX_EXPORT_BYTES) {
    throw new ExportLimitError(
      `This export is about ${Math.round(estimatedBytes / (1024 * 1024))} MB; the limit is ${Math.round(
        MAX_EXPORT_BYTES / (1024 * 1024)
      )} MB. Narrow the selection.`
    );
  }

  const chunks: Uint8Array[] = [];
  let zipError: Error | null = null;
  let exportFailures: ExportFailure[] = [];
  let exportedCount = 0;
  const done = new Promise<void>((resolve, reject) => {
    const zip = new Zip((error, chunk, final) => {
      if (error) {
        zipError = error;
        reject(error);
        return;
      }
      if (chunk) chunks.push(chunk);
      if (final) resolve();
    });

    void (async () => {
      const usedNames = new Map<string, number>();
      const manifest: ReturnType<typeof manifestRecord>[] = [];
      const failures: ExportFailure[] = [];
      let completed = 0;

      try {
        for (const item of items) {
          if (options.signal?.aborted) {
            throw new ExportCancelledError('Export cancelled');
          }

          const entryName = uniqueEntryName(item, usedNames);
          options.onProgress?.({ completed, total: items.length, currentName: entryName });

          try {
            const response = await fetch(buildVfsFileUrl(item.hash), {
              cache: 'no-store',
              signal: options.signal,
            });
            if (!response.ok) {
              failures.push({ hash: item.hash, reason: `HTTP ${response.status}` });
              continue;
            }
            const buffer = await response.arrayBuffer();
            const stream = new ZipPassThrough(entryName);
            zip.add(stream);
            stream.push(new Uint8Array(buffer), true);
            manifest.push(manifestRecord(item, entryName));
          } catch (error) {
            if (options.signal?.aborted) throw error;
            failures.push({
              hash: item.hash,
              reason: error instanceof Error ? error.message : 'Failed to read media',
            });
          } finally {
            completed += 1;
            options.onProgress?.({ completed, total: items.length, currentName: entryName });
          }
        }

        if (options.signal?.aborted) {
          throw new ExportCancelledError('Export cancelled');
        }

        const manifestStream = new ZipPassThrough('metadata.json');
        zip.add(manifestStream);
        manifestStream.push(
          strToU8(
            JSON.stringify(
              { exportedAt: new Date().toISOString(), failures, items: manifest },
              null,
              2
            )
          ),
          true
        );
        exportFailures = failures;
        exportedCount = manifest.length;
        zip.end();
      } catch (error) {
        zip.terminate();
        reject(error);
      }
    })();
  });

  await done;
  if (zipError) throw zipError;

  const fileName = archiveName(new Date());
  const parts: BlobPart[] = chunks.map((chunk) => {
    const copy = new Uint8Array(chunk.byteLength);
    copy.set(chunk);
    return copy.buffer;
  });
  const blob = new Blob(parts, { type: 'application/zip' });
  await saveBlob(blob, fileName);

  return { fileName, exported: exportedCount, failures: exportFailures };
}
