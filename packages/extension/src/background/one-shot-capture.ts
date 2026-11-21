/**
 * One-shot media capture.
 *
 * Resolves bytes for a user-selected candidate from the page, then saves them
 * through the existing ingest path. This module never touches the capture
 * session store or the debugger.
 */

import type {
  OneShotErrorCode,
  OneShotMediaCandidate,
  OneShotSaveResult,
  PageScanResult,
} from '../shared/extension-runtime';
import { scanPageForMedia } from './page-scan';

const HTTP_MAX_BYTES = 50 * 1024 * 1024;
const DATA_MAX_BYTES = 50 * 1024 * 1024;
const BLOB_MAX_BYTES = 20 * 1024 * 1024;
const MIN_BYTES = 1024;
const FETCH_TIMEOUT_MS = 15_000;

export interface OneShotSaveDependencies {
  saveMedia: (data: {
    buffer: number[];
    mimeType: string;
    url: string;
    capturedAt: string;
  }) => Promise<{ hash: string; duplicate: boolean }>;
}

class OneShotCaptureError extends Error {
  constructor(
    readonly code: OneShotErrorCode,
    message: string
  ) {
    super(message);
  }
}

function normalizeMime(value: string | null | undefined): string {
  return (value ?? '').split(';', 1)[0].trim().toLowerCase();
}

function inferMimeType(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const extension = pathname.split('.').pop() ?? '';
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      bmp: 'image/bmp',
      tif: 'image/tiff',
      tiff: 'image/tiff',
      avif: 'image/avif',
      svg: 'image/svg+xml',
    };
    return map[extension] ?? null;
  } catch {
    return null;
  }
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mimeType: string } {
  const match = /^data:([^,]*),(.*)$/s.exec(dataUrl);
  if (!match) {
    throw new OneShotCaptureError('decode-failed', 'Invalid data URL');
  }
  const meta = match[1] ?? '';
  const payload = match[2] ?? '';
  const parts = meta.split(';');
  const mimeType = normalizeMime(parts[0]);
  if (!mimeType.startsWith('image/')) {
    throw new OneShotCaptureError(
      'unsupported-mime',
      `Unsupported data URL type: ${mimeType || 'unknown'}`
    );
  }
  const base64 = parts.some((part) => part.trim().toLowerCase() === 'base64');
  let bytes: Uint8Array;
  try {
    if (base64) {
      const binary = atob(payload);
      bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(payload));
    }
  } catch (error) {
    throw new OneShotCaptureError(
      'decode-failed',
      error instanceof Error ? error.message : 'Failed to decode data URL'
    );
  }
  if (bytes.byteLength > DATA_MAX_BYTES) {
    throw new OneShotCaptureError('too-large', 'Data URL exceeds the size limit');
  }
  return { bytes, mimeType };
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, credentials: 'include' });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new OneShotCaptureError('timeout', 'Timed out while fetching the image');
    }
    throw new OneShotCaptureError(
      'fetch-failed',
      error instanceof Error ? error.message : 'Failed to fetch the image'
    );
  } finally {
    clearTimeout(timer);
  }
}

async function resolveHttpCandidate(
  candidate: OneShotMediaCandidate
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const response = await fetchWithTimeout(candidate.url);
  if (!response.ok) {
    throw new OneShotCaptureError('fetch-failed', `HTTP ${response.status}`);
  }
  const mimeType =
    normalizeMime(response.headers.get('content-type')) || inferMimeType(candidate.url);
  if (!mimeType || !mimeType.startsWith('image/')) {
    throw new OneShotCaptureError(
      'unsupported-mime',
      `Response is not an image: ${mimeType || 'unknown'}`
    );
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > HTTP_MAX_BYTES) {
    throw new OneShotCaptureError('too-large', 'Image exceeds the 50 MB limit');
  }
  return { bytes: new Uint8Array(buffer), mimeType };
}

/**
 * Fetches a page-owned blob URL in the page's MAIN world. This function is
 * serialized by executeScript and must remain self-contained.
 */
async function extractBlobInPage(
  blobUrl: string
): Promise<{ dataUrl?: string; mimeType?: string; error?: string }> {
  const maxBytes = 20 * 1024 * 1024;
  try {
    const response = await fetch(blobUrl);
    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      return { error: 'too-large' };
    }
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    const mimeType = (response.headers.get('content-type') ?? 'application/octet-stream')
      .split(';', 1)[0]
      .trim()
      .toLowerCase();
    return {
      dataUrl: `data:${mimeType};base64,${btoa(binary)}`,
      mimeType,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function resolveBlobCandidate(
  tabId: number,
  candidate: OneShotMediaCandidate
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  let injected: chrome.scripting.InjectionResult<Awaited<ReturnType<typeof extractBlobInPage>>>[];
  try {
    injected = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: extractBlobInPage,
      args: [candidate.url],
    });
  } catch (error) {
    throw new OneShotCaptureError(
      'expired-blob',
      error instanceof Error ? error.message : 'Blob URL is no longer available'
    );
  }
  const result = injected[0]?.result;
  if (!result?.dataUrl) {
    const reason = result?.error;
    if (reason === 'too-large') {
      throw new OneShotCaptureError('too-large', 'Blob exceeds the 20 MB limit');
    }
    throw new OneShotCaptureError('expired-blob', reason ?? 'Blob URL is unavailable');
  }
  const decoded = decodeDataUrl(result.dataUrl);
  if (decoded.bytes.byteLength > BLOB_MAX_BYTES) {
    throw new OneShotCaptureError('too-large', 'Blob exceeds the 20 MB limit');
  }
  return decoded;
}

async function resolveCandidateBytes(
  tabId: number,
  candidate: OneShotMediaCandidate
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const url = candidate.url.trim();
  if (!url) {
    throw new OneShotCaptureError('fetch-failed', 'Empty candidate URL');
  }
  if (url.startsWith('data:')) {
    return decodeDataUrl(url);
  }
  if (url.startsWith('blob:')) {
    return resolveBlobCandidate(tabId, candidate);
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return resolveHttpCandidate(candidate);
  }
  throw new OneShotCaptureError('unsupported-mime', `Unsupported URL scheme: ${url.slice(0, 32)}`);
}

function failure(
  candidate: OneShotMediaCandidate,
  code: OneShotErrorCode,
  message: string
): OneShotSaveResult {
  return {
    candidateId: candidate.id,
    saved: false,
    duplicate: false,
    errorCode: code,
    error: message,
  };
}

/**
 * Resolve and save one candidate. Per-item failures are returned, never thrown.
 */
export async function saveOneShotCandidate(
  tabId: number,
  candidate: OneShotMediaCandidate,
  dependencies: OneShotSaveDependencies
): Promise<OneShotSaveResult> {
  try {
    const resolved = await resolveCandidateBytes(tabId, candidate);
    if (resolved.bytes.byteLength < MIN_BYTES) {
      return {
        candidateId: candidate.id,
        saved: false,
        duplicate: false,
        skipped: true,
        errorCode: 'too-small',
        error: 'Image is smaller than 1 KB',
      };
    }

    const result = await dependencies.saveMedia({
      buffer: Array.from(resolved.bytes),
      mimeType: resolved.mimeType,
      url: candidate.url,
      capturedAt: new Date().toISOString(),
    });

    return {
      candidateId: candidate.id,
      hash: result.hash,
      duplicate: result.duplicate,
      saved: !result.duplicate,
    };
  } catch (error) {
    if (error instanceof OneShotCaptureError) {
      return failure(candidate, error.code, error.message);
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    const vfsDisconnected = /not connected|WebSocket|ECONNREFUSED/i.test(message);
    return failure(candidate, vfsDisconnected ? 'vfs-disconnected' : 'unknown', message);
  }
}

/**
 * Inject the scanner into the active tab and return its candidates.
 */
export async function scanTabForMedia(tabId: number): Promise<PageScanResult> {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: scanPageForMedia,
    });
    const result = injection?.result as PageScanResult | undefined;
    if (!result) {
      throw new Error('The page scanner returned no result');
    }
    return result;
  } catch (error) {
    throw new OneShotCaptureError(
      'restricted-page',
      error instanceof Error ? error.message : 'This page cannot be scanned'
    );
  }
}

/**
 * Save an image URL coming from the context menu.
 */
export async function saveContextMenuImage(
  tabId: number,
  srcUrl: string,
  pageUrl: string,
  dependencies: OneShotSaveDependencies
): Promise<OneShotSaveResult> {
  const candidate: OneShotMediaCandidate = {
    id: `context:${srcUrl}`,
    kind: 'img',
    url: srcUrl,
    pageUrl,
  };
  return saveOneShotCandidate(tabId, candidate, dependencies);
}
