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

  it('uses the AI filename in Content-Disposition', async () => {
    const saved = api.saveFile({
      buffer: Buffer.from('fake-png-data'),
      mimeType: 'image/png',
      sourceUrl: 'https://www.example.com/photo',
    });
    api.updateMetadata({ hash: saved.hash, updates: { ai_filename: '海边日落' } });

    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/files/${saved.hash}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('content-disposition')).toContain(
      "filename*=UTF-8''%E6%B5%B7%E8%BE%B9%E6%97%A5%E8%90%BD.png"
    );
    expect(response.headers.get('content-disposition')).toContain('filename="____.png"');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('falls back to the hash when no AI filename exists', async () => {
    const saved = api.saveFile({
      buffer: Buffer.from('fake-png-data'),
      mimeType: 'image/png',
    });

    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/files/${saved.hash}`);
    expect(response.headers.get('content-disposition')).toContain(`filename="${saved.hash}.png"`);
  });

  it('sanitizes path separators, control characters, and quotes', async () => {
    const saved = api.saveFile({
      buffer: Buffer.from('fake-png-data'),
      mimeType: 'image/png',
    });
    api.updateMetadata({ hash: saved.hash, updates: { ai_filename: '../../evil"\r\nname' } });

    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/files/${saved.hash}`);
    const disposition = response.headers.get('content-disposition') ?? '';

    expect(disposition).not.toMatch(/[\r\n]/);
    expect(disposition).not.toContain('/');
    expect(disposition).not.toContain('\\');
    expect(
      buildDownloadName({ hash: saved.hash, blob_ext: 'png', ai_filename: 'CON' }).fullName
    ).toBe('_CON.png');
  });
});
