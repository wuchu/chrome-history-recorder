/**
 * Parser and state helpers for the unified Media Library search bar.
 *
 * The raw query string is the source of truth. This module turns it into the
 * structured list query sent to the background worker and exposes removable
 * chips for the UI.
 */

import type { TaskStatus } from '../../shared/extension-runtime';

export type MediaSearchChipKind =
  | 'term'
  | 'exclude'
  | 'tag'
  | 'site'
  | 'type'
  | 'status'
  | 'date'
  | 'starred';

export interface MediaSearchChip {
  id: string;
  kind: MediaSearchChipKind;
  label: string;
  start: number;
  end: number;
}

export interface ParsedMediaQuery {
  raw: string;
  terms: string[];
  excludeTerms: string[];
  tags: string[];
  tagMode: 'and' | 'or';
  tagGroups: string[][];
  sourceDomains: string[];
  mimeType?: 'image' | 'video';
  capturedFrom?: string;
  capturedTo?: string;
  starred?: boolean;
  classifyStatus?: TaskStatus;
  chips: MediaSearchChip[];
  incompleteQualifier?: string;
}

export interface MediaQueryToken {
  text: string;
  raw: string;
  start: number;
  end: number;
  quoted: boolean;
  negated: boolean;
}

export interface ActiveMediaQueryToken {
  text: string;
  start: number;
  end: number;
  quoted: boolean;
}

type Qualifier =
  | 'tag'
  | 'site'
  | 'type'
  | 'status'
  | 'date'
  | 'after'
  | 'before'
  | 'starred'
  | 'is';

const QUALIFIER_ALIASES: Record<string, Qualifier> = {
  tag: 'tag',
  标签: 'tag',
  site: 'site',
  站点: 'site',
  来源: 'site',
  type: 'type',
  类型: 'type',
  status: 'status',
  状态: 'status',
  date: 'date',
  时间: 'date',
  after: 'after',
  之后: 'after',
  晚于: 'after',
  before: 'before',
  之前: 'before',
  早于: 'before',
  starred: 'starred',
  收藏: 'starred',
  is: 'is',
};

const TYPE_ALIASES: Record<string, 'image' | 'video'> = {
  image: 'image',
  图片: 'image',
  video: 'video',
  视频: 'video',
};

const STATUS_ALIASES: Record<string, TaskStatus> = {
  pending: 'pending',
  待分类: 'pending',
  processing: 'processing',
  分类中: 'processing',
  completed: 'completed',
  已完成: 'completed',
  failed: 'failed',
  失败: 'failed',
  skipped: 'skipped',
  已跳过: 'skipped',
  跳过: 'skipped',
};

const RELATIVE_DATE_ALIASES: Record<string, number | 'today' | 'all'> = {
  today: 'today',
  今天: 'today',
  all: 'all',
  全部: 'all',
  '7d': 7,
  最近7天: 7,
  '30d': 30,
  最近30天: 30,
  '90d': 90,
  最近90天: 90,
};

export function normalizeSearchValue(value: string): string {
  return value.normalize('NFKC').toLowerCase().trim();
}

/**
 * Split a raw query into tokens while preserving their offsets. Quoted
 * segments may contain whitespace; the parser strips the quotes for matching
 * but records that the token was quoted so free terms can stay phrases.
 */
export function tokenizeMediaQuery(raw: string): MediaQueryToken[] {
  const tokens: MediaQueryToken[] = [];
  let index = 0;

  while (index < raw.length) {
    while (index < raw.length && /\s/.test(raw[index])) index += 1;
    if (index >= raw.length) break;

    const start = index;
    let negated = false;
    if (raw[index] === '-' && index + 1 < raw.length && !/\s/.test(raw[index + 1])) {
      negated = true;
      index += 1;
    }

    let text = '';
    let quoted = false;
    while (index < raw.length && !/\s/.test(raw[index])) {
      if (raw[index] === '"') {
        quoted = true;
        index += 1;
        while (index < raw.length && raw[index] !== '"') {
          text += raw[index];
          index += 1;
        }
        if (index < raw.length && raw[index] === '"') index += 1;
      } else {
        text += raw[index];
        index += 1;
      }
    }

    tokens.push({
      text,
      raw: raw.slice(start, index),
      start,
      end: index,
      quoted,
      negated,
    });
  }

  return tokens;
}

function splitQualifier(text: string): { key: string; value: string } | null {
  const colonIndex = text.search(/[:：]/);
  if (colonIndex < 0) return null;
  return {
    key: normalizeSearchValue(text.slice(0, colonIndex)),
    value: text.slice(colonIndex + 1).trim(),
  };
}

function normalizeTagValue(value: string): string {
  return normalizeSearchValue(value).replace(/^#+/, '').replace(/\s+/g, ' ').trim();
}

function normalizeSiteValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    const host = url.hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return normalizeSearchValue(trimmed)
      .replace(/^www\./, '')
      .split('/')[0];
  }
}

function parseRelativeDate(value: string, now: Date): string | undefined {
  const alias = RELATIVE_DATE_ALIASES[normalizeSearchValue(value)];
  if (alias === undefined) return undefined;
  if (alias === 'all') return undefined;
  if (alias === 'today') return startOfDay(now).toISOString();
  const from = new Date(now);
  from.setDate(from.getDate() - alias);
  return startOfDay(from).toISOString();
}

function parseAbsoluteDate(value: string, endOfDay: boolean): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.toISOString();
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addChip(
  chips: MediaSearchChip[],
  kind: MediaSearchChipKind,
  label: string,
  start: number,
  end: number
): void {
  chips.push({ id: `${kind}:${start}:${end}`, kind, label, start, end });
}

export interface ParseMediaQueryOptions {
  /** Injectable clock for deterministic relative-date parsing. */
  now?: Date;
}

/**
 * Parse one raw query string into free terms, exclusions, facets, and chips.
 */
export function parseMediaQuery(
  raw: string,
  options: ParseMediaQueryOptions = {}
): ParsedMediaQuery {
  const now = options.now ?? new Date();
  const parsed: ParsedMediaQuery = {
    raw,
    terms: [],
    excludeTerms: [],
    tags: [],
    tagMode: 'and',
    tagGroups: [],
    sourceDomains: [],
    chips: [],
  };

  for (const token of tokenizeMediaQuery(raw)) {
    const text = token.text.trim();
    if (!text) continue;

    if (text.startsWith('#') && text.length > 1) {
      const name = normalizeTagValue(text);
      if (!name) continue;
      if (token.negated) {
        parsed.excludeTerms.push(name);
        addChip(parsed.chips, 'exclude', `排除: #${name}`, token.start, token.end);
      } else {
        parsed.tags.push(name);
        addChip(parsed.chips, 'tag', `标签: ${name}`, token.start, token.end);
      }
      continue;
    }

    const qualified = splitQualifier(text);
    const qualifier = qualified ? QUALIFIER_ALIASES[qualified.key] : undefined;

    if (qualified && qualifier) {
      const value = qualified.value;
      if (!value) {
        parsed.incompleteQualifier = qualifier;
        continue;
      }

      if (token.negated) {
        parsed.excludeTerms.push(value);
        addChip(parsed.chips, 'exclude', `排除: ${value}`, token.start, token.end);
        continue;
      }

      switch (qualifier) {
        case 'tag': {
          const names = value.split('|').map(normalizeTagValue).filter(Boolean);
          if (names.length === 0) break;
          if (names.length === 1) {
            parsed.tags.push(names[0]);
          } else {
            parsed.tagGroups.push(names);
          }
          addChip(
            parsed.chips,
            'tag',
            names.length === 1 ? `标签: ${names[0]}` : `标签: ${names.join(' 或 ')}`,
            token.start,
            token.end
          );
          break;
        }
        case 'site': {
          const domain = normalizeSiteValue(value);
          if (!domain) break;
          if (!parsed.sourceDomains.includes(domain)) parsed.sourceDomains.push(domain);
          addChip(parsed.chips, 'site', `站点: ${domain}`, token.start, token.end);
          break;
        }
        case 'type': {
          const type = TYPE_ALIASES[normalizeSearchValue(value)];
          if (!type) break;
          parsed.mimeType = type;
          addChip(
            parsed.chips,
            'type',
            `类型: ${type === 'image' ? '图片' : '视频'}`,
            token.start,
            token.end
          );
          break;
        }
        case 'status': {
          const status = STATUS_ALIASES[normalizeSearchValue(value)];
          if (!status) break;
          parsed.classifyStatus = status;
          addChip(parsed.chips, 'status', `状态: ${value}`, token.start, token.end);
          break;
        }
        case 'date': {
          const from = parseRelativeDate(value, now);
          if (!from) break;
          parsed.capturedFrom = from;
          addChip(parsed.chips, 'date', `时间: ${value}`, token.start, token.end);
          break;
        }
        case 'after': {
          const from = parseAbsoluteDate(value, false);
          if (!from) break;
          parsed.capturedFrom = from;
          addChip(parsed.chips, 'date', `时间: ${value} 之后`, token.start, token.end);
          break;
        }
        case 'before': {
          const to = parseAbsoluteDate(value, true);
          if (!to) break;
          parsed.capturedTo = to;
          addChip(parsed.chips, 'date', `时间: ${value} 之前`, token.start, token.end);
          break;
        }
        case 'starred': {
          parsed.starred = true;
          addChip(parsed.chips, 'starred', '仅收藏', token.start, token.end);
          break;
        }
        case 'is': {
          if (normalizeSearchValue(value) === 'starred') {
            parsed.starred = true;
            addChip(parsed.chips, 'starred', '仅收藏', token.start, token.end);
          }
          break;
        }
      }
      continue;
    }

    const normalized = normalizeSearchValue(text);
    if (!token.negated && (normalized === 'starred' || normalized === '收藏')) {
      parsed.starred = true;
      addChip(parsed.chips, 'starred', '仅收藏', token.start, token.end);
      continue;
    }

    if (token.negated) {
      parsed.excludeTerms.push(text);
      addChip(parsed.chips, 'exclude', `排除: ${text}`, token.start, token.end);
    } else {
      parsed.terms.push(text);
      addChip(parsed.chips, 'term', token.quoted ? `"${text}"` : text, token.start, token.end);
    }
  }

  return parsed;
}

/**
 * Return the token under the cursor, or an empty token at the cursor when the
 * cursor sits between tokens.
 */
export function findActiveMediaQueryToken(
  raw: string,
  cursor?: number | null
): ActiveMediaQueryToken {
  const position = Math.max(0, Math.min(cursor ?? raw.length, raw.length));
  const tokens = tokenizeMediaQuery(raw);
  for (const token of tokens) {
    if (position > token.start && position <= token.end) {
      return {
        text: token.text,
        start: token.start,
        end: token.end,
        quoted: token.quoted,
      };
    }
  }
  if (position === 0) {
    const first = tokens[0];
    if (first && first.start === 0) {
      return { text: first.text, start: first.start, end: first.end, quoted: first.quoted };
    }
  }
  return { text: '', start: position, end: position, quoted: false };
}

/**
 * Remove one applied-condition chip from the raw query.
 */
export function removeMediaSearchChip(raw: string, chip: MediaSearchChip): string {
  const before = raw.slice(0, chip.start);
  const after = raw.slice(chip.end);
  return `${before}${after}`.replace(/\s{2,}/g, ' ').trim();
}

function isTagFacetToken(token: MediaQueryToken): boolean {
  if (token.negated) return false;
  if (token.text.startsWith('#') && token.text.length > 1) return true;
  const qualified = splitQualifier(token.text);
  return Boolean(qualified && QUALIFIER_ALIASES[qualified.key] === 'tag');
}

/**
 * Replace all tag conditions with a single tag token, or remove them when no
 * tag name is provided. Non-tag conditions are preserved.
 */
export function replaceMediaQueryTagTokens(raw: string, tagName?: string): string {
  const kept = tokenizeMediaQuery(raw)
    .filter((token) => !isTagFacetToken(token))
    .map((token) => token.raw)
    .join(' ')
    .trim();
  if (!tagName) return kept;
  return kept ? `${kept} tag:${tagName}` : `tag:${tagName}`;
}

/**
 * Replace the active token with a suggestion. Recent searches replace the
 * whole query; other suggestions replace only the token being typed.
 */
export function applyMediaSearchSuggestion(
  raw: string,
  active: ActiveMediaQueryToken,
  insertText: string,
  replaceAll = false
): string {
  if (replaceAll) return insertText;
  const left = raw.slice(0, active.start);
  const right = raw.slice(active.end).replace(/^\s+/, '');
  const leftSeparator = left.length > 0 && !/\s$/.test(left) ? ' ' : '';
  const rightSeparator = right.length > 0 ? ' ' : '';
  return `${left}${leftSeparator}${insertText}${rightSeparator}${right}`.trim();
}

export const RECENT_SEARCHES_KEY = 'media-search-recent-v1';
export const MAX_RECENT_SEARCHES = 8;

export interface RecentSearchStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export function mergeRecentSearches(existing: string[], query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return existing;
  return [trimmed, ...existing.filter((entry) => entry !== trimmed)].slice(0, MAX_RECENT_SEARCHES);
}

export async function loadRecentSearches(
  storage: RecentSearchStorage = chrome.storage.local
): Promise<string[]> {
  try {
    const stored = await storage.get(RECENT_SEARCHES_KEY);
    const value = stored[RECENT_SEARCHES_KEY];
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function saveRecentSearch(
  query: string,
  storage: RecentSearchStorage = chrome.storage.local
): Promise<string[]> {
  const current = await loadRecentSearches(storage);
  const next = mergeRecentSearches(current, query);
  const unchanged =
    next.length === current.length && next.every((entry, index) => entry === current[index]);
  if (unchanged) return current;
  try {
    await storage.set({ [RECENT_SEARCHES_KEY]: next });
  } catch {
    // Recent searches are a convenience; failures must not block search.
  }
  return next;
}

export async function clearRecentSearches(
  storage: RecentSearchStorage = chrome.storage.local
): Promise<void> {
  try {
    await storage.remove(RECENT_SEARCHES_KEY);
  } catch {
    // Ignore storage failures.
  }
}
