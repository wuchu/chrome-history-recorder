/**
 * VFS Service - Buffered video assembly tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  AssemblyCapacityError,
  AssemblyIncompleteError,
  AssemblyInvalidError,
  AssemblyManager,
  AssemblyUnauthorizedError,
} from '../src/assembly';
import { VFSAPI } from '../src/api';
import { SQLiteDatabase, ensureWorkspace } from '../src/sqlite';
import { BlobStorage } from '../src/blob';
import { ThumbnailStorage } from '../src/thumbnail';
import { VFSHTTPServer } from '../src/http-server';

/** Minimal MP4 header so signature validation accepts the payload. */
function fakeMp4(payload: string): Buffer {
  return Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from('ftypmp42'),
    Buffer.from(payload),
  ]);
}

function tempAssemblyFiles(workspace: string): string[] {
  const dir = path.join(workspace, '.tmp', 'assemblies');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir);
}

async function waitForListening(server: VFSHTTPServer): Promise<number> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const port = server.getPort();
    if (port !== 0) return port;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('HTTP server did not start');
}

describe('AssemblyManager', () => {
  let api: VFSAPI;
  let db: SQLiteDatabase;
  let workspace: string;
  let manager: AssemblyManager;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'vfs-assembly-'));
    ensureWorkspace(workspace);
    db = new SQLiteDatabase(workspace);
    api = new VFSAPI(db, new BlobStorage(workspace), new ThumbnailStorage(workspace), workspace);
    manager = new AssemblyManager(api, workspace, {
      maxBytes: 64 * 1024,
      maxConcurrent: 2,
      sweepIntervalMs: 0,
    });
  });

  afterEach(async () => {
    await manager.abortAll();
    manager.close();
    db.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('stores a complete single-range assembly', async () => {
    const data = fakeMp4('hello world');
    const job = await manager.createJob({
      totalSize: data.length,
      mimeType: 'video/mp4',
      sourceUrl: 'https://example.com/v.mp4',
    });

    await manager.writeChunk(job.jobId, job.token, 0, data);
    const result = await manager.complete(job.jobId, job.token);

    expect(result.duplicate).toBe(false);
    expect(result.size).toBe(data.length);
    expect(api.getMetadata(result.hash)).not.toBeNull();
    expect(tempAssemblyFiles(workspace)).toEqual([]);
    expect(manager.getActiveCount()).toBe(0);
  });

  it('merges out-of-order and overlapping ranges', async () => {
    const data = Buffer.concat([fakeMp4(''), Buffer.alloc(80, 0x41)]);
    const job = await manager.createJob({ totalSize: data.length, mimeType: 'video/mp4' });

    const split = Math.floor(data.length / 2);
    await manager.writeChunk(job.jobId, job.token, split, data.subarray(split));
    await manager.writeChunk(job.jobId, job.token, 0, data.subarray(0, split + 4));
    await manager.writeChunk(job.jobId, job.token, 0, data.subarray(0, split));

    const result = await manager.complete(job.jobId, job.token);
    expect(result.size).toBe(data.length);
  });

  it('rejects finalization when a gap remains', async () => {
    const data = fakeMp4('abcdefghij');
    const job = await manager.createJob({ totalSize: data.length, mimeType: 'video/mp4' });
    await manager.writeChunk(job.jobId, job.token, 0, data.subarray(0, 5));

    await expect(manager.complete(job.jobId, job.token)).rejects.toBeInstanceOf(
      AssemblyIncompleteError
    );
    await expect(manager.complete(job.jobId, job.token)).rejects.toMatchObject({
      missingBytes: data.length - 5,
    });

    await manager.abort(job.jobId, job.token);
    expect(tempAssemblyFiles(workspace)).toEqual([]);
  });

  it('rejects invalid tokens, offsets, and bodies', async () => {
    const data = fakeMp4('payload');
    const job = await manager.createJob({ totalSize: data.length, mimeType: 'video/mp4' });

    await expect(manager.writeChunk(job.jobId, 'wrong', 0, data)).rejects.toBeInstanceOf(
      AssemblyUnauthorizedError
    );
    await expect(manager.writeChunk(job.jobId, job.token, -1, data)).rejects.toBeInstanceOf(
      AssemblyInvalidError
    );
    await expect(
      manager.writeChunk(job.jobId, job.token, 0, Buffer.alloc(0))
    ).rejects.toBeInstanceOf(AssemblyInvalidError);
    await expect(
      manager.writeChunk(job.jobId, job.token, data.length, Buffer.from('x'))
    ).rejects.toBeInstanceOf(AssemblyInvalidError);
  });

  it('enforces the concurrent job limit', async () => {
    await manager.createJob({ totalSize: 1000, mimeType: 'video/mp4' });
    await manager.createJob({ totalSize: 1000, mimeType: 'video/mp4' });

    await expect(
      manager.createJob({ totalSize: 1000, mimeType: 'video/mp4' })
    ).rejects.toBeInstanceOf(AssemblyCapacityError);
  });

  it('expires inactive jobs', async () => {
    let clock = 1_000_000;
    const expiring = new AssemblyManager(api, workspace, {
      maxBytes: 64 * 1024,
      inactivityMs: 1000,
      sweepIntervalMs: 0,
      now: () => clock,
    });

    await expiring.createJob({ totalSize: 1000, mimeType: 'video/mp4' });
    expect(expiring.getActiveCount()).toBe(1);
    expect(tempAssemblyFiles(workspace).length).toBe(1);

    clock += 2000;
    await expiring.sweep();

    expect(expiring.getActiveCount()).toBe(0);
    expect(tempAssemblyFiles(workspace)).toEqual([]);
    expiring.close();
  });
});

describe('assembly HTTP endpoints', () => {
  let api: VFSAPI;
  let db: SQLiteDatabase;
  let workspace: string;
  let manager: AssemblyManager;
  let server: VFSHTTPServer;
  let baseUrl: string;

  beforeEach(async () => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'vfs-assembly-http-'));
    ensureWorkspace(workspace);
    db = new SQLiteDatabase(workspace);
    api = new VFSAPI(db, new BlobStorage(workspace), new ThumbnailStorage(workspace), workspace);
    manager = new AssemblyManager(api, workspace, {
      maxBytes: 64 * 1024,
      maxConcurrent: 4,
      sweepIntervalMs: 0,
    });
    server = new VFSHTTPServer(api, { port: 0, host: '127.0.0.1', assembly: manager });
    const port = await waitForListening(server);
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    server.close();
    await manager.abortAll();
    manager.close();
    db.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  async function createJob(totalSize: number): Promise<{ jobId: string; token: string }> {
    const response = await fetch(`${baseUrl}/assemblies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalSize, mimeType: 'video/mp4' }),
    });
    expect(response.status).toBe(201);
    return (await response.json()) as { jobId: string; token: string };
  }

  it('creates, writes, and finalizes a job', async () => {
    const data = fakeMp4('http assembly');
    const job = await createJob(data.length);

    const write = await fetch(`${baseUrl}/assemblies/${job.jobId}/chunks?offset=0`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Assembly-Token': job.token,
      },
      body: data,
    });
    expect(write.status).toBe(204);
    expect(write.headers.get('x-assembly-received')).toBe(String(data.length));

    const complete = await fetch(`${baseUrl}/assemblies/${job.jobId}/complete`, {
      method: 'POST',
      headers: { 'X-Assembly-Token': job.token },
    });
    expect(complete.status).toBe(200);
    const result = (await complete.json()) as { hash: string; size: number; duplicate: boolean };
    expect(result.size).toBe(data.length);
    expect(result.duplicate).toBe(false);
    expect(api.getMetadata(result.hash)).not.toBeNull();
  });

  it('rejects missing tokens and wrong content types', async () => {
    const job = await createJob(100);

    const noToken = await fetch(`${baseUrl}/assemblies/${job.jobId}/chunks?offset=0`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: Buffer.from('x'),
    });
    expect(noToken.status).toBe(403);

    const wrongType = await fetch(`${baseUrl}/assemblies/${job.jobId}/chunks?offset=0`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
        'X-Assembly-Token': job.token,
      },
      body: 'x',
    });
    expect(wrongType.status).toBe(415);

    const badToken = await fetch(`${baseUrl}/assemblies/${job.jobId}/chunks?offset=0`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Assembly-Token': 'wrong',
      },
      body: Buffer.from('x'),
    });
    expect(badToken.status).toBe(403);
  });

  it('rejects missing offsets', async () => {
    const job = await createJob(100);
    const response = await fetch(`${baseUrl}/assemblies/${job.jobId}/chunks`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Assembly-Token': job.token,
      },
      body: Buffer.from('x'),
    });
    expect(response.status).toBe(400);
  });

  it('returns 409 with missing bytes for an incomplete job', async () => {
    const job = await createJob(100);
    await fetch(`${baseUrl}/assemblies/${job.jobId}/chunks?offset=0`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Assembly-Token': job.token,
      },
      body: Buffer.from('x'),
    });

    const complete = await fetch(`${baseUrl}/assemblies/${job.jobId}/complete`, {
      method: 'POST',
      headers: { 'X-Assembly-Token': job.token },
    });
    expect(complete.status).toBe(409);
    const payload = (await complete.json()) as { missingBytes: number };
    expect(payload.missingBytes).toBe(99);
  });

  it('does not grant CORS to web origins but echoes extension origins', async () => {
    const web = await fetch(`${baseUrl}/assemblies`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });
    expect(web.headers.get('access-control-allow-origin')).toBeNull();

    const extension = await fetch(`${baseUrl}/assemblies`, {
      method: 'OPTIONS',
      headers: { Origin: 'chrome-extension://abcdef' },
    });
    expect(extension.headers.get('access-control-allow-origin')).toBe('chrome-extension://abcdef');
  });
});
