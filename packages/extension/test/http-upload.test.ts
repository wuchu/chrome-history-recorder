import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadMedia, UploadMediaError, VFS_HTTP_BASE_URL } from '../src/background/http-upload';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('uploadMedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uploads bytes with metadata headers', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ hash: 'abc', duplicate: false, size: 4, mimeType: 'image/png' })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await uploadMedia({
      buffer: new Uint8Array([1, 2, 3, 4]),
      mimeType: 'image/png',
      sourceUrl: 'https://example.com/a.png',
      capturedAt: '2024-01-01T00:00:00.000Z',
    });

    expect(result).toEqual({
      hash: 'abc',
      duplicate: false,
      restored: undefined,
      size: 4,
      mimeType: 'image/png',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${VFS_HTTP_BASE_URL}/upload`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'image/png',
          'X-Source-Url': 'https://example.com/a.png',
          'X-Captured-At': '2024-01-01T00:00:00.000Z',
        },
      })
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeInstanceOf(Uint8Array);
  });

  it('reports duplicates and restores', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ hash: 'abc', duplicate: true, restored: true, size: 4 }))
    );

    const result = await uploadMedia({ buffer: [1, 2, 3, 4], mimeType: 'image/png' });
    expect(result.duplicate).toBe(true);
    expect(result.restored).toBe(true);
  });

  it('honours a custom base URL', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ hash: 'abc', duplicate: false, size: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    await uploadMedia(
      { buffer: new Uint8Array([1]), mimeType: 'image/png' },
      { baseUrl: 'http://127.0.0.1:9999/' }
    );

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:9999/upload', expect.anything());
  });

  it('maps network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Failed to fetch');
      })
    );

    await expect(
      uploadMedia({ buffer: new Uint8Array([1]), mimeType: 'image/png' })
    ).rejects.toMatchObject({ name: 'UploadMediaError', kind: 'network' });
  });

  it('maps HTTP status errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'too large' }, 413))
    );

    await expect(
      uploadMedia({ buffer: new Uint8Array([1]), mimeType: 'image/png' })
    ).rejects.toMatchObject({ kind: 'http', status: 413, message: 'too large' });
  });

  it('rejects an invalid response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, text: async () => 'not-json' }) as Response)
    );

    const error = await uploadMedia({
      buffer: new Uint8Array([1]),
      mimeType: 'image/png',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UploadMediaError);
    expect((error as UploadMediaError).kind).toBe('invalid-response');
  });
});
