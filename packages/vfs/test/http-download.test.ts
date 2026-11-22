import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { VFSAPI } from '../src/api';
import { SQLiteDatabase, ensureWorkspace } from '../src/sqlite';
import { BlobStorage } from '../src/blob';
import { ThumbnailStorage } from '../src/thumbnail';
import { VFSHTTPServer, buildDownloadName } from '../src/http-server';

async function waitForListening(server: VFSHTTPServer): Promise<number> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const port = server.getPort();
    if (port !== 0) return port;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('HTTP server did not start');
}

describe('HTTP download naming', () => {
  let api: VFSAPI;
  let db: SQLiteDatabase;
  let workspace: string;
  let server: VFSHTTPServer | null = null;

  beforeEach(() => {
    workspace = path.join(
      os.tmpdir(),
      `vfs-download-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    ensureWorkspace(workspace);
    db = new SQLiteDatabase(workspace);
    const blobStorage = new BlobStorage(workspace);
    const thumbnailStorage = new ThumbnailStorage(workspace);
    api = new VFSAPI(db, blobStorage, thumbnailStorage, workspace);
  });

  afterEach(() => {
    server?.close();
    server = null;
    try {
      db.close();
    } catch {
      // ignore
    }
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  async function startServer(): Promise<string> {
    server = new VFSHTTPServer(api, { port: 0, host: '127.0.0.1' });
    const port = await waitForListening(server);
    return `http://127.0.0.1:${port}`;
  }

  it('uses the AI filename in Content-Disposition for downloads', async () => {
    const saved = api.saveFile({
      buffer: Buffer.from('fake-png-data'),
      mimeType: 'image/png',
      sourceUrl: 'https://www.example.com/photo',
    });
    api.updateMetadata({ hash: saved.hash, updates: { ai_filename: '海边日落' } });

    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/files/${saved.hash}?download=1`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('content-disposition')).toContain(
      "filename*=UTF-8''%E6%B5%B7%E8%BE%B9%E6%97%A5%E8%90%BD.png"
    );
    expect(response.headers.get('content-disposition')).toContain('filename="____.png"');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('defaults to inline preview with validators', async () => {
    const saved = api.saveFile({
      buffer: Buffer.from('fake-png-data'),
      mimeType: 'image/png',
    });

    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/files/${saved.hash}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toBe('inline');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('etag')).toBe(`"${saved.hash}"`);
    expect(response.headers.get('last-modified')).toBeTruthy();
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('fake-png-data');
  });

  it('serves byte ranges', async () => {
    const saved = api.saveFile({
      buffer: Buffer.from('0123456789'),
      mimeType: 'image/png',
    });
    const baseUrl = await startServer();

    const first = await fetch(`${baseUrl}/files/${saved.hash}`, {
      headers: { Range: 'bytes=0-3' },
    });
    expect(first.status).toBe(206);
    expect(first.headers.get('content-range')).toBe('bytes 0-3/10');
    expect(first.headers.get('content-length')).toBe('4');
    expect(await first.text()).toBe('0123');

    const middle = await fetch(`${baseUrl}/files/${saved.hash}`, {
      headers: { Range: 'bytes=3-6' },
    });
    expect(middle.status).toBe(206);
    expect(await middle.text()).toBe('3456');

    const tail = await fetch(`${baseUrl}/files/${saved.hash}`, {
      headers: { Range: 'bytes=7-' },
    });
    expect(tail.status).toBe(206);
    expect(tail.headers.get('content-range')).toBe('bytes 7-9/10');
    expect(await tail.text()).toBe('789');

    const suffix = await fetch(`${baseUrl}/files/${saved.hash}`, {
      headers: { Range: 'bytes=-3' },
    });
    expect(suffix.status).toBe(206);
    expect(await suffix.text()).toBe('789');
  });

  it('rejects invalid and multi-range requests', async () => {
    const saved = api.saveFile({
      buffer: Buffer.from('0123456789'),
      mimeType: 'image/png',
    });
    const baseUrl = await startServer();

    for (const range of ['bytes=20-30', 'bytes=5-2', 'bytes=0-1,4-5', 'items=0-1']) {
      const response = await fetch(`${baseUrl}/files/${saved.hash}`, {
        headers: { Range: range },
      });
      expect(response.status).toBe(416);
      expect(response.headers.get('content-range')).toBe('bytes */10');
    }
  });

  it('returns 304 when the ETag matches', async () => {
    const saved = api.saveFile({
      buffer: Buffer.from('fake-png-data'),
      mimeType: 'image/png',
    });
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/files/${saved.hash}`, {
      headers: { 'If-None-Match': `"${saved.hash}"` },
    });
    expect(response.status).toBe(304);
    expect(await response.text()).toBe('');
  });

  it('supports HEAD without a body', async () => {
    const saved = api.saveFile({
      buffer: Buffer.from('fake-png-data'),
      mimeType: 'image/png',
    });
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/files/${saved.hash}`, { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('13');
    expect(response.headers.get('etag')).toBe(`"${saved.hash}"`);
    expect(await response.text()).toBe('');
  });

  it('falls back to the hash when no AI filename exists', async () => {
    const saved = api.saveFile({
      buffer: Buffer.from('fake-png-data'),
      mimeType: 'image/png',
    });

    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/files/${saved.hash}?download=1`);
    expect(response.headers.get('content-disposition')).toContain(`filename="${saved.hash}.png"`);
  });

  it('sanitizes path separators, control characters, and quotes', async () => {
    const saved = api.saveFile({
      buffer: Buffer.from('fake-png-data'),
      mimeType: 'image/png',
    });
    api.updateMetadata({ hash: saved.hash, updates: { ai_filename: '../../evil"\r\nname' } });

    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/files/${saved.hash}?download=1`);
    const disposition = response.headers.get('content-disposition') ?? '';

    expect(disposition).not.toMatch(/[\r\n]/);
    expect(disposition).not.toContain('/');
    expect(disposition).not.toContain('\\');
    expect(
      buildDownloadName({ hash: saved.hash, blob_ext: 'png', ai_filename: 'CON' }).fullName
    ).toBe('_CON.png');
  });
});
