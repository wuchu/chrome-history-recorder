/**
 * VFS Service - Streaming Upload Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';
import { VFSAPI, UploadEmptyError, UploadTooLargeError } from '../src/api';
import { SQLiteDatabase, ensureWorkspace } from '../src/sqlite';
import { BlobStorage, calculateHash } from '../src/blob';
import { ThumbnailStorage } from '../src/thumbnail';
import { VFSHTTPServer } from '../src/http-server';

async function waitForListening(server: VFSHTTPServer): Promise<number> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const port = server.getPort();
    if (port !== 0) return port;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('HTTP server did not start');
}

function listTempFiles(workspacePath: string): string[] {
  const tmpPath = path.join(workspacePath, '.tmp');
  if (!fs.existsSync(tmpPath)) return [];
  return fs.readdirSync(tmpPath);
}

/** Minimal MP4 header so signature validation accepts the payload. */
function fakeMp4(payload: string): Buffer {
  return Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from('ftypmp42'),
    Buffer.from(payload),
  ]);
}

describe('Streaming upload', () => {
  let api: VFSAPI;
  let db: SQLiteDatabase;
  let blobStorage: BlobStorage;
  let thumbnailStorage: ThumbnailStorage;
  let workspace: string;
  let server: VFSHTTPServer | null = null;

  const maxUploadSize = 64 * 1024;

  beforeEach(() => {
    workspace = path.join(
      os.tmpdir(),
      `vfs-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    ensureWorkspace(workspace);
    db = new SQLiteDatabase(workspace);
    blobStorage = new BlobStorage(workspace);
    thumbnailStorage = new ThumbnailStorage(workspace);
    api = new VFSAPI(db, blobStorage, thumbnailStorage, workspace);
  });

  afterEach(() => {
    server?.close();
    server = null;
    try {
      db.close();
    } catch {
      // Ignore cleanup errors.
    }
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  async function startServer(): Promise<string> {
    server = new VFSHTTPServer(api, { port: 0, host: '127.0.0.1', maxUploadSize });
    const port = await waitForListening(server);
    return `http://127.0.0.1:${port}`;
  }

  it('stores a streamed video upload with metadata and system tag', async () => {
    const baseUrl = await startServer();
    const body = fakeMp4('fake video bytes');

    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'video/mp4',
        'X-Source-Url': 'https://example.com/video.mp4',
        'X-Captured-At': '2024-01-01T00:00:00.000Z',
      },
      body,
    });

    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      hash: string;
      duplicate: boolean;
      size: number;
      mimeType: string;
    };

    expect(result.duplicate).toBe(false);
    expect(result.size).toBe(body.length);
    expect(result.mimeType).toBe('video/mp4');
    expect(result.hash).toBe(calculateHash(body));
    expect(blobStorage.blobExists(result.hash, 'mp4')).toBe(true);

    const metadata = db.getFile(result.hash);
    expect(metadata?.mime_type).toBe('video/mp4');
    expect(metadata?.source_url).toBe('https://example.com/video.mp4');
    expect(metadata?.captured_at).toBe('2024-01-01T00:00:00.000Z');
    expect(JSON.parse(metadata?.tags ?? '[]')).toContain('system:video');
    expect(api.getStats().videos).toBe(1);

    const download = await fetch(`${baseUrl}/files/${result.hash}`);
    expect(download.status).toBe(200);
    expect(Buffer.from(await download.arrayBuffer()).equals(body)).toBe(true);
  });

  it('stores a streamed image upload with metadata and system tag', async () => {
    const baseUrl = await startServer();
    const body = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('fake image bytes'),
    ]);

    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'X-Source-Url': 'https://example.com/photo.png',
      },
      body,
    });

    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      hash: string;
      duplicate: boolean;
      size: number;
      mimeType: string;
    };

    expect(result.duplicate).toBe(false);
    expect(result.size).toBe(body.length);
    expect(result.mimeType).toBe('image/png');
    expect(result.hash).toBe(calculateHash(body));

    const metadata = db.getFile(result.hash);
    expect(metadata?.mime_type).toBe('image/png');
    expect(metadata?.source_url).toBe('https://example.com/photo.png');
    expect(JSON.parse(metadata?.tags ?? '[]')).toContain('system:image');
    expect(api.getStats().images).toBe(1);
  });

  it('reports duplicate content without inserting a second row', async () => {
    const baseUrl = await startServer();
    const body = fakeMp4('duplicate video bytes');
    const headers = { 'Content-Type': 'video/mp4' };

    const first = await fetch(`${baseUrl}/upload`, { method: 'POST', headers, body });
    const second = await fetch(`${baseUrl}/upload`, { method: 'POST', headers, body });

    const firstResult = (await first.json()) as { hash: string; duplicate: boolean };
    const secondResult = (await second.json()) as { hash: string; duplicate: boolean };

    expect(firstResult.duplicate).toBe(false);
    expect(secondResult.duplicate).toBe(true);
    expect(secondResult.hash).toBe(firstResult.hash);
    expect(api.getStats().totalFiles).toBe(1);
    expect(listTempFiles(workspace)).toEqual([]);
  });

  it('rejects video content without a container signature', async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'video/mp4' },
      body: Buffer.from('this is not an mp4 file'),
    });

    expect(response.status).toBe(415);
    expect(api.getStats().totalFiles).toBe(0);
    expect(listTempFiles(workspace)).toEqual([]);
  });

  it('rejects an upload whose declared length exceeds the limit', async () => {
    const baseUrl = await startServer();
    const body = Buffer.alloc(maxUploadSize + 1, 1);

    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'video/mp4' },
      body,
    });

    expect(response.status).toBe(413);
    expect(api.getStats().totalFiles).toBe(0);
  });

  it('rejects unsupported MIME types', async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: Buffer.from('pdf bytes'),
    });

    expect(response.status).toBe(415);
    expect(api.getStats().totalFiles).toBe(0);
  });

  it('rejects a request without a content type', async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: new Uint8Array([1, 2, 3]),
    });

    expect(response.status).toBe(400);
  });

  it('rejects an empty upload body', async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'video/mp4' },
      body: new Uint8Array(0),
    });

    expect(response.status).toBe(400);
  });

  it('answers upload CORS preflight with POST allowed', async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/upload`, { method: 'OPTIONS' });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-headers')).toContain('X-Source-Url');
  });

  it('cleans up the temporary file when the stream exceeds the limit', async () => {
    const stream = new Readable({
      read() {
        this.push(Buffer.alloc(maxUploadSize + 1, 1));
        this.push(null);
      },
    });

    await expect(
      api.saveFileFromStream({
        stream,
        mimeType: 'video/mp4',
        maxBytes: maxUploadSize,
      })
    ).rejects.toBeInstanceOf(UploadTooLargeError);

    expect(listTempFiles(workspace)).toEqual([]);
    expect(api.getStats().totalFiles).toBe(0);
  });

  it('cleans up the temporary file when the upload is interrupted', async () => {
    const stream = new Readable({
      read() {
        this.push(Buffer.from('partial'));
        this.destroy(new Error('connection reset'));
      },
    });

    await expect(
      api.saveFileFromStream({
        stream,
        mimeType: 'video/mp4',
        maxBytes: maxUploadSize,
      })
    ).rejects.toThrow('connection reset');

    expect(listTempFiles(workspace)).toEqual([]);
    expect(api.getStats().totalFiles).toBe(0);
  });

  it('rejects an empty streamed body', async () => {
    await expect(
      api.saveFileFromStream({
        stream: Readable.from([]),
        mimeType: 'video/mp4',
        maxBytes: maxUploadSize,
      })
    ).rejects.toBeInstanceOf(UploadEmptyError);

    expect(listTempFiles(workspace)).toEqual([]);
  });
});
