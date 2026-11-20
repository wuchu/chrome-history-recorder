import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OllamaClient, type MediaReader } from '../src/ollama-client';

const media: MediaReader = {
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
});
