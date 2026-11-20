import { describe, expect, it } from 'vitest';
import { filterMediaByTag } from '../src/entrypoints/options/media-filter';
import type { CombinedMediaItem } from '../src/entrypoints/media-browser/hooks/useCombinedMedia';

function item(hash: string, mimeType: string, tags: string[] = []): CombinedMediaItem {
  return {
    hash,
    mimeType,
    size: 100,
    capturedAt: '2026-01-01T00:00:00.000Z',
    url: `http://localhost:8766/files/${hash}`,
    thumbnailUrl: `http://localhost:8766/files/${hash}/thumbnail?size=medium`,
    tags,
  };
}

describe('filterMediaByTag', () => {
  const items = [
    item('img-unclassified', 'image/png'),
    item('img-cat', 'image/jpeg', ['system:image', 'cat']),
    item('video-dog', 'video/mp4', ['system:video', 'dog']),
    item('img-starred', 'image/webp', ['system:image', 'system:starred']),
  ];

  it('returns everything for the all tab', () => {
    expect(filterMediaByTag(items, 'all')).toHaveLength(4);
  });

  it('filters by system media type', () => {
    expect(filterMediaByTag(items, 'system:image').map((entry) => entry.hash)).toEqual([
      'img-unclassified',
      'img-cat',
      'img-starred',
    ]);
    expect(filterMediaByTag(items, 'system:video').map((entry) => entry.hash)).toEqual([
      'video-dog',
    ]);
  });

  it('filters by user tag', () => {
    expect(filterMediaByTag(items, 'cat').map((entry) => entry.hash)).toEqual(['img-cat']);
    expect(filterMediaByTag(items, 'dog').map((entry) => entry.hash)).toEqual(['video-dog']);
  });

  it('filters uncategorized media', () => {
    expect(filterMediaByTag(items, 'system:uncategorized').map((entry) => entry.hash)).toEqual([
      'img-unclassified',
      'img-starred',
    ]);
  });

  it('filters starred media', () => {
    expect(filterMediaByTag(items, 'system:starred').map((entry) => entry.hash)).toEqual([
      'img-starred',
    ]);
  });
});
