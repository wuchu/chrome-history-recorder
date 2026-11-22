import { describe, expect, it } from 'vitest';
import {
  applyMediaSearchSuggestion,
  clearRecentSearches,
  findActiveMediaQueryToken,
  loadRecentSearches,
  mergeRecentSearches,
  parseMediaQuery,
  removeMediaSearchChip,
  replaceMediaQueryTagTokens,
  saveRecentSearch,
  tokenizeMediaQuery,
  type RecentSearchStorage,
} from '../src/entrypoints/options/media-search-query';
import {
  getMediaSearchSuggestions,
  getNoResultActions,
  type MediaSearchSuggestionContext,
} from '../src/entrypoints/options/media-search-suggestions';

const NOW = new Date(2026, 10, 22, 12, 0, 0);

function context(
  overrides: Partial<MediaSearchSuggestionContext> = {}
): MediaSearchSuggestionContext {
  return {
    tags: [
      { name: 'cat', label: 'cat', usage_count: 12 },
      { name: 'dog', label: 'dog', usage_count: 4 },
      { name: '壁纸', label: '壁纸', usage_count: 9 },
    ],
    domains: [
      { domain: 'pixiv.net', count: 20 },
      { domain: 'example.com', count: 3 },
    ],
    recentSearches: ['cat wallpaper', 'status:failed'],
    ...overrides,
  };
}

function createStorage(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  const storage: RecentSearchStorage & { data: Record<string, unknown> } = {
    data,
    async get(key) {
      return { [key]: data[key] };
    },
    async set(items) {
      Object.assign(data, items);
    },
    async remove(key) {
      delete data[key];
    },
  };
  return storage;
}

describe('media search query parser', () => {
  it('tokenizes quoted phrases and keeps offsets', () => {
    const tokens = tokenizeMediaQuery('"digital art" tag:cat');
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({ text: 'digital art', quoted: true, start: 0, end: 13 });
    expect(tokens[1]).toMatchObject({ text: 'tag:cat', quoted: false });
  });

  it('parses free terms, phrases, and exclusions', () => {
    const parsed = parseMediaQuery('猫 壁纸 "digital art" -nsfw', { now: NOW });
    expect(parsed.terms).toEqual(['猫', '壁纸', 'digital art']);
    expect(parsed.excludeTerms).toEqual(['nsfw']);
    expect(parsed.chips.map((chip) => chip.kind)).toEqual(['term', 'term', 'term', 'exclude']);
  });

  it('parses tag tokens including AND, OR groups, and shorthand', () => {
    expect(parseMediaQuery('tag:猫 tag:狗').tags).toEqual(['猫', '狗']);
    expect(parseMediaQuery('tag:猫|狗').tagGroups).toEqual([['猫', '狗']]);
    expect(parseMediaQuery('#猫').tags).toEqual(['猫']);
    expect(parseMediaQuery('tag:猫|狗 tag:可爱')).toMatchObject({
      tags: ['可爱'],
      tagGroups: [['猫', '狗']],
    });
  });

  it('normalizes quoted tag values and site URLs', () => {
    expect(parseMediaQuery('tag:"digital art"').tags).toEqual(['digital art']);
    expect(parseMediaQuery('site:https://www.Pixiv.net/path').sourceDomains).toEqual(['pixiv.net']);
    expect(parseMediaQuery('site:pixiv.net site:x.com').sourceDomains).toEqual([
      'pixiv.net',
      'x.com',
    ]);
  });

  it('parses type, status, and starred aliases', () => {
    expect(parseMediaQuery('类型:图片').mimeType).toBe('image');
    expect(parseMediaQuery('type:video').mimeType).toBe('video');
    expect(parseMediaQuery('状态:失败').classifyStatus).toBe('failed');
    expect(parseMediaQuery('status:skipped').classifyStatus).toBe('skipped');
    expect(parseMediaQuery('收藏').starred).toBe(true);
    expect(parseMediaQuery('is:starred').starred).toBe(true);
  });

  it('parses relative and absolute dates with an injected clock', () => {
    expect(parseMediaQuery('date:today', { now: NOW }).capturedFrom).toBe(
      new Date(2026, 10, 22).toISOString()
    );
    expect(parseMediaQuery('时间:最近7天', { now: NOW }).capturedFrom).toBe(
      new Date(2026, 10, 15).toISOString()
    );
    expect(parseMediaQuery('after:2026-11-01', { now: NOW }).capturedFrom).toBe(
      new Date(2026, 10, 1).toISOString()
    );
    expect(parseMediaQuery('before:2026-11-22', { now: NOW }).capturedTo).toBe(
      new Date(2026, 10, 22, 23, 59, 59, 999).toISOString()
    );
  });

  it('keeps unknown qualifiers and URL schemes as free text', () => {
    const parsed = parseMediaQuery('foo:bar https://example.com/file.jpg');
    expect(parsed.terms).toEqual(['foo:bar', 'https://example.com/file.jpg']);
    expect(parsed.chips).toHaveLength(2);
  });

  it('does not apply an incomplete qualifier', () => {
    const parsed = parseMediaQuery('tag:');
    expect(parsed.tags).toEqual([]);
    expect(parsed.chips).toEqual([]);
    expect(parsed.incompleteQualifier).toBe('tag');
  });

  it('builds removable chips and removes them without touching other conditions', () => {
    const parsed = parseMediaQuery('猫 tag:cat site:pixiv.net');
    const tagChip = parsed.chips.find((chip) => chip.kind === 'tag')!;
    expect(removeMediaSearchChip(parsed.raw, tagChip)).toBe('猫 site:pixiv.net');
  });

  it('replaces tag tokens while keeping non-tag conditions', () => {
    expect(replaceMediaQueryTagTokens('猫 tag:old site:x.com', 'new')).toBe(
      '猫 site:x.com tag:new'
    );
    expect(replaceMediaQueryTagTokens('猫 tag:old site:x.com')).toBe('猫 site:x.com');
    expect(replaceMediaQueryTagTokens('tag:old', 'new')).toBe('tag:new');
  });

  it('finds the token at the cursor and applies suggestions', () => {
    const active = findActiveMediaQueryToken('猫 tag:ca', null);
    expect(active.text).toBe('tag:ca');
    const next = applyMediaSearchSuggestion('猫 tag:ca', active, 'tag:cat');
    expect(next).toBe('猫 tag:cat');

    const empty = findActiveMediaQueryToken('猫 ', null);
    expect(empty.text).toBe('');
    expect(applyMediaSearchSuggestion('猫 ', empty, '壁纸')).toBe('猫 壁纸');
  });

  it('merges recent searches with dedupe and a cap', () => {
    expect(mergeRecentSearches(['a', 'b'], 'b')).toEqual(['b', 'a']);
    expect(mergeRecentSearches(['a'], '  ')).toEqual(['a']);
    const full = Array.from({ length: 8 }, (_, index) => `q${index}`);
    expect(mergeRecentSearches(full, 'new')).toHaveLength(8);
    expect(mergeRecentSearches(full, 'new')[0]).toBe('new');
  });

  it('persists, loads, and clears recent searches', async () => {
    const storage = createStorage();
    expect(await loadRecentSearches(storage)).toEqual([]);

    await saveRecentSearch('cat', storage);
    await saveRecentSearch('dog', storage);
    expect(await loadRecentSearches(storage)).toEqual(['dog', 'cat']);

    await clearRecentSearches(storage);
    expect(await loadRecentSearches(storage)).toEqual([]);
  });
});

describe('media search suggestions', () => {
  it('suggests matching tags with usage counts and insertion text', () => {
    const suggestions = getMediaSearchSuggestions('ca', context());
    expect(suggestions[0]).toMatchObject({
      kind: 'tag',
      label: 'cat',
      insertText: 'tag:cat',
      detail: '12 项',
    });
  });

  it('suggests tags after a tag qualifier', () => {
    const suggestions = getMediaSearchSuggestions('tag:壁', context());
    expect(suggestions[0]).toMatchObject({
      kind: 'tag',
      label: '壁纸',
      insertText: 'tag:壁纸',
    });
  });

  it('suggests source domains after a site qualifier', () => {
    const suggestions = getMediaSearchSuggestions('site:pix', context());
    expect(suggestions[0]).toMatchObject({
      kind: 'site',
      label: 'pixiv.net',
      insertText: 'site:pixiv.net',
    });
  });

  it('suggests static dimension values', () => {
    expect(getMediaSearchSuggestions('type:im', context())[0]).toMatchObject({
      kind: 'type',
      insertText: 'type:image',
    });
    expect(getMediaSearchSuggestions('status:fa', context())[0]).toMatchObject({
      kind: 'status',
      insertText: 'status:failed',
    });
    expect(getMediaSearchSuggestions('date:7', context())[0]).toMatchObject({
      kind: 'date',
      insertText: 'date:7d',
    });
  });

  it('returns recent searches, top tags, top sites, and quick filters for an empty query', () => {
    const suggestions = getMediaSearchSuggestions('', context());
    expect(suggestions.some((suggestion) => suggestion.kind === 'recent')).toBe(true);
    expect(suggestions.some((suggestion) => suggestion.kind === 'tag')).toBe(true);
    expect(suggestions.some((suggestion) => suggestion.kind === 'site')).toBe(true);
    expect(suggestions.some((suggestion) => suggestion.kind === 'quick')).toBe(true);
  });

  it('does not invent a rewrite for unmatched text', () => {
    const suggestions = getMediaSearchSuggestions('pikvi', context());
    expect(suggestions.every((suggestion) => suggestion.kind !== 'tag')).toBe(true);
    expect(suggestions.every((suggestion) => suggestion.kind !== 'site')).toBe(true);
  });

  it('builds no-result recovery actions from chips and matches', () => {
    const parsed = parseMediaQuery('猫 tag:cat site:pixiv.net');
    const actions = getNoResultActions(parsed, context());
    expect(actions[0].label).toContain('去掉');
    expect(actions.some((action) => action.label === '清除全部条件')).toBe(true);
  });
});
