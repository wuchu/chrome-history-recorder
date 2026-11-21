import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OllamaClient, type MediaReader } from '../src/ollama-client';
import { isUnprocessableMediaError } from '../src/errors';

const DECODABLE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff'];

const media: MediaReader = {
  getMediaInfo: () => ({ mimeType: 'image/jpeg' }),
  getDecodableImageMimeTypes: () => DECODABLE,
  getThumbnail: async () => ({ buffer: Buffer.from([1, 2, 3]), mimeType: 'image/jpeg' }),
  getFile: () => ({ buffer: Buffer.from([1, 2, 3]), mimeType: 'image/jpeg' }),
  getTagVocabulary: () => ['cat', 'dog'],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const target = String(url);
    if (target.endsWith('/api/tags')) {
      return jsonResponse({ models: [{ name: 'llava:7b' }] });
    }
    if (target.endsWith('/api/chat')) {
      const body = JSON.parse(String(init?.body));
      const prompt = String(body.messages?.[0]?.content ?? '');
      if (prompt.includes('文件名')) {
        return jsonResponse({ message: { content: '一只猫' } });
      }
      return jsonResponse({ message: { content: 'cat\nNEW:fluffy' } });
    }
    return new Response('', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('OllamaClient', () => {
  it('reports health from /api/tags', async () => {
    const client = new OllamaClient({ model: 'llava:7b', media });
    await expect(client.checkHealth()).resolves.toBe(true);
    expect(client.isAvailable()).toBe(true);
  });

  it('classifies using the injected media reader and vocabulary', async () => {
    const client = new OllamaClient({ model: 'llava:7b', media });
    await client.checkHealth();

    const result = await client.classifyTagsByHash('hash-1');

    expect(result.tags).toEqual(['cat', 'fluffy']);
    expect(result.model).toBe('llava:7b');

    const chatCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/chat'));
    expect(chatCall).toBeDefined();
    const body = JSON.parse(String(chatCall?.[1]?.body));
    expect(body.messages[0].content).toContain('cat、dog');
    expect(body.messages[0].images[0]).toBe(Buffer.from([1, 2, 3]).toString('base64'));
  });

  it('produces a sanitized rename result', async () => {
    const client = new OllamaClient({ model: 'llava:7b', media });
    await client.checkHealth();

    await expect(client.renameByHash('hash-2')).resolves.toEqual({
      suggestedName: '一只猫',
      model: 'llava:7b',
    });
  });

  it('falls back to the original file when thumbnails fail', async () => {
    const failingMedia: MediaReader = {
      getMediaInfo: () => ({ mimeType: 'image/png' }),
      getDecodableImageMimeTypes: () => DECODABLE,
      getThumbnail: async () => {
        throw new Error('thumbnail unavailable');
      },
      getFile: () => ({ buffer: Buffer.from([9, 8, 7]), mimeType: 'image/png' }),
      getTagVocabulary: () => [],
    };
    const client = new OllamaClient({ model: 'llava:7b', media: failingMedia });
    await client.checkHealth();

    const result = await client.classifyTagsByHash('hash-3');
    expect(result.tags).toEqual(['cat', 'fluffy']);
  });

  it('skips unsupported formats before calling Ollama', async () => {
    const icoMedia: MediaReader = {
      getMediaInfo: () => ({ mimeType: 'image/x-icon' }),
      getDecodableImageMimeTypes: () => DECODABLE,
      getThumbnail: async () => null,
      getFile: () => ({ buffer: Buffer.from([1, 2, 3]), mimeType: 'image/x-icon' }),
      getTagVocabulary: () => [],
    };
    const client = new OllamaClient({ model: 'llava:7b', media: icoMedia });
    await client.checkHealth();

    await expect(client.classifyTagsByHash('ico-hash')).rejects.toMatchObject({
      name: 'UnprocessableMediaError',
      reason: 'unsupported-format',
    });
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/chat'))).toBe(false);
  });

  it('reports a video without a representative frame as permanent', async () => {
    const videoMedia: MediaReader = {
      getMediaInfo: () => ({ mimeType: 'video/mp4' }),
      getDecodableImageMimeTypes: () => DECODABLE,
      getThumbnail: async () => null,
      getFile: () => ({ buffer: Buffer.from([1, 2, 3]), mimeType: 'video/mp4' }),
      getTagVocabulary: () => [],
    };
    const client = new OllamaClient({ model: 'llava:7b', media: videoMedia });
    await client.checkHealth();

    await expect(client.renameByHash('video-hash')).rejects.toMatchObject({
      name: 'UnprocessableMediaError',
      reason: 'no-representative-frame',
    });
  });

  it('reports invalid media bytes as permanent', async () => {
    const emptyMedia: MediaReader = {
      getMediaInfo: () => ({ mimeType: 'image/jpeg' }),
      getDecodableImageMimeTypes: () => DECODABLE,
      getThumbnail: async () => null,
      getFile: () => ({ buffer: Buffer.alloc(0), mimeType: 'image/jpeg' }),
      getTagVocabulary: () => [],
    };
    const client = new OllamaClient({ model: 'llava:7b', media: emptyMedia });
    await client.checkHealth();

    await expect(client.classifyTagsByHash('empty-hash')).rejects.toMatchObject({
      name: 'UnprocessableMediaError',
      reason: 'invalid-media',
    });
  });

  it('keeps missing media as a transient error', async () => {
    const missingMedia: MediaReader = {
      getMediaInfo: () => null,
      getDecodableImageMimeTypes: () => DECODABLE,
      getThumbnail: async () => null,
      getFile: () => null,
      getTagVocabulary: () => [],
    };
    const client = new OllamaClient({ model: 'llava:7b', media: missingMedia });
    await client.checkHealth();

    const error = await client.classifyTagsByHash('missing-hash').catch((caught) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(isUnprocessableMediaError(error)).toBe(false);
  });
});
