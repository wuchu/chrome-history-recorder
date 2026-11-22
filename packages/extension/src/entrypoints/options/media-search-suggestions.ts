/**
 * Local suggestion and recommendation helpers for the unified search bar.
 *
 * Suggestions are derived from the tag vocabulary, source-domain counts, and
 * recent searches. They never rewrite the user's text on their own.
 */

import {
  applyMediaSearchSuggestion,
  normalizeSearchValue,
  removeMediaSearchChip,
  tokenizeMediaQuery,
  type ParsedMediaQuery,
} from './media-search-query';

export interface TagSuggestionSource {
  name: string;
  label?: string | null;
  usage_count?: number;
  is_pinned?: number;
}

export interface DomainSuggestionSource {
  domain: string;
  count: number;
}

export interface MediaSearchSuggestionContext {
  tags: TagSuggestionSource[];
  domains: DomainSuggestionSource[];
  recentSearches: string[];
}

export type MediaSearchSuggestionKind =
  | 'tag'
  | 'site'
  | 'type'
  | 'status'
  | 'date'
  | 'starred'
  | 'recent'
  | 'quick';

export interface MediaSearchSuggestion {
  id: string;
  kind: MediaSearchSuggestionKind;
  label: string;
  detail?: string;
  insertText: string;
  replaceAll?: boolean;
  score: number;
}

export interface NoResultAction {
  id: string;
  label: string;
  nextQuery: string;
}

type ActiveQualifier =
  | 'tag'
  | 'site'
  | 'type'
  | 'status'
  | 'date'
  | 'starred'
  | 'is'
  | 'after'
  | 'before';

const ACTIVE_QUALIFIERS: Record<string, ActiveQualifier> = {
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
  starred: 'starred',
  收藏: 'starred',
  is: 'is',
  after: 'after',
  之后: 'after',
  before: 'before',
  之前: 'before',
};

const QUICK_FILTERS: MediaSearchSuggestion[] = [
  {
    id: 'quick:image',
    kind: 'quick',
    label: '只看图片',
    insertText: 'type:image',
    score: 1,
  },
  {
    id: 'quick:video',
    kind: 'quick',
    label: '只看视频',
    insertText: 'type:video',
    score: 1,
  },
  {
    id: 'quick:starred',
    kind: 'quick',
    label: '仅收藏',
    insertText: 'starred',
    score: 1,
  },
  {
    id: 'quick:7d',
    kind: 'quick',
    label: '最近 7 天',
    insertText: 'date:7d',
    score: 1,
  },
  {
    id: 'quick:uncategorized',
    kind: 'quick',
    label: '未分类',
    insertText: 'tag:uncategorized',
    score: 1,
  },
  {
    id: 'quick:failed',
    kind: 'quick',
    label: '处理失败',
    insertText: 'status:failed',
    score: 1,
  },
];

const TYPE_SUGGESTIONS: MediaSearchSuggestion[] = [
  { id: 'type:image', kind: 'type', label: '图片', insertText: 'type:image', score: 1 },
  { id: 'type:video', kind: 'type', label: '视频', insertText: 'type:video', score: 1 },
];

const STATUS_SUGGESTIONS: MediaSearchSuggestion[] = [
  { id: 'status:pending', kind: 'status', label: '待分类', insertText: 'status:pending', score: 1 },
  {
    id: 'status:processing',
    kind: 'status',
    label: '分类中',
    insertText: 'status:processing',
    score: 1,
  },
  {
    id: 'status:completed',
    kind: 'status',
    label: '已完成',
    insertText: 'status:completed',
    score: 1,
  },
  { id: 'status:failed', kind: 'status', label: '失败', insertText: 'status:failed', score: 1 },
  { id: 'status:skipped', kind: 'status', label: '已跳过', insertText: 'status:skipped', score: 1 },
];

const DATE_SUGGESTIONS: MediaSearchSuggestion[] = [
  { id: 'date:today', kind: 'date', label: '今天', insertText: 'date:today', score: 1 },
  { id: 'date:7d', kind: 'date', label: '最近 7 天', insertText: 'date:7d', score: 1 },
  { id: 'date:30d', kind: 'date', label: '最近 30 天', insertText: 'date:30d', score: 1 },
  { id: 'date:90d', kind: 'date', label: '最近 90 天', insertText: 'date:90d', score: 1 },
];

function scoreCandidate(query: string, candidate: string): number {
  const normalizedQuery = normalizeSearchValue(query);
  const normalizedCandidate = normalizeSearchValue(candidate);
  if (!normalizedQuery) return 1;
  if (!normalizedCandidate) return 0;
  if (normalizedCandidate === normalizedQuery) return 1000;
  if (normalizedCandidate.startsWith(normalizedQuery)) return 800;
  if (normalizedCandidate.includes(normalizedQuery)) return 500;
  return 0;
}

function usageBonus(count: number | undefined): number {
  return Math.min(Math.max(count ?? 0, 0), 100) / 1000;
}

function tagSuggestions(
  query: string,
  context: MediaSearchSuggestionContext,
  limit = 5
): MediaSearchSuggestion[] {
  return context.tags
    .map((tag) => {
      const label = tag.label || tag.name;
      const score = Math.max(scoreCandidate(query, tag.name), scoreCandidate(query, label));
      return {
        id: `tag:${tag.name}`,
        kind: 'tag' as const,
        label,
        detail: `${tag.usage_count ?? 0} 项`,
        insertText: `tag:${tag.name}`,
        score: score + usageBonus(tag.usage_count),
      };
    })
    .filter((suggestion) => suggestion.score > 1)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function siteSuggestions(
  query: string,
  context: MediaSearchSuggestionContext,
  limit = 4
): MediaSearchSuggestion[] {
  return context.domains
    .map((entry) => ({
      id: `site:${entry.domain}`,
      kind: 'site' as const,
      label: entry.domain,
      detail: `${entry.count} 项`,
      insertText: `site:${entry.domain}`,
      score: scoreCandidate(query, entry.domain) + usageBonus(entry.count),
    }))
    .filter((suggestion) => suggestion.score > 1)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function recentSuggestions(
  query: string,
  context: MediaSearchSuggestionContext,
  limit = 5
): MediaSearchSuggestion[] {
  return context.recentSearches
    .map((entry) => ({
      id: `recent:${entry}`,
      kind: 'recent' as const,
      label: entry,
      insertText: entry,
      replaceAll: true,
      score: scoreCandidate(query, entry) + 1,
    }))
    .filter((suggestion) => suggestion.score > 1)
    .slice(0, limit);
}

function quickSuggestions(query: string, limit = QUICK_FILTERS.length): MediaSearchSuggestion[] {
  return QUICK_FILTERS.map((entry) => ({
    ...entry,
    score: Math.max(scoreCandidate(query, entry.label), scoreCandidate(query, entry.insertText)),
  }))
    .filter((suggestion) => !query || suggestion.score > 1)
    .slice(0, limit);
}

function staticSuggestions(qualifier: ActiveQualifier, query: string): MediaSearchSuggestion[] {
  const source =
    qualifier === 'type'
      ? TYPE_SUGGESTIONS
      : qualifier === 'status'
        ? STATUS_SUGGESTIONS
        : qualifier === 'date'
          ? DATE_SUGGESTIONS
          : qualifier === 'starred' || qualifier === 'is'
            ? [
                {
                  id: 'starred:only',
                  kind: 'starred' as const,
                  label: '仅收藏',
                  insertText: 'starred',
                  score: 1,
                },
              ]
            : [];
  return source
    .map((entry) => ({
      ...entry,
      score: Math.max(scoreCandidate(query, entry.label), scoreCandidate(query, entry.insertText)),
    }))
    .filter((entry) => !query || entry.score > 1);
}

function detectQualifier(activeText: string): { qualifier: ActiveQualifier; value: string } | null {
  const trimmed = activeText.trim();
  if (trimmed.startsWith('#')) {
    return { qualifier: 'tag', value: trimmed.slice(1) };
  }
  const colonIndex = trimmed.search(/[:：]/);
  if (colonIndex < 0) return null;
  const key = normalizeSearchValue(trimmed.slice(0, colonIndex));
  const qualifier = ACTIVE_QUALIFIERS[key];
  if (!qualifier) return null;
  return { qualifier, value: trimmed.slice(colonIndex + 1).trim() };
}

/**
 * Return grouped suggestions for the token currently being typed. An empty
 * active token returns the empty-state recommendation set.
 */
export function getMediaSearchSuggestions(
  activeText: string,
  context: MediaSearchSuggestionContext
): MediaSearchSuggestion[] {
  const qualifier = detectQualifier(activeText);

  if (qualifier) {
    switch (qualifier.qualifier) {
      case 'tag':
        return tagSuggestions(qualifier.value, context);
      case 'site':
        return siteSuggestions(qualifier.value, context);
      case 'type':
      case 'status':
      case 'date':
      case 'starred':
      case 'is':
        return staticSuggestions(qualifier.qualifier, qualifier.value);
      case 'after':
      case 'before':
        return [];
    }
  }

  const query = activeText.trim();
  if (!query) {
    return [
      ...recentSuggestions('', context, 4),
      ...context.tags.slice(0, 5).map((tag) => ({
        id: `tag:${tag.name}`,
        kind: 'tag' as const,
        label: tag.label || tag.name,
        detail: `${tag.usage_count ?? 0} 项`,
        insertText: `tag:${tag.name}`,
        score: usageBonus(tag.usage_count),
      })),
      ...context.domains.slice(0, 3).map((entry) => ({
        id: `site:${entry.domain}`,
        kind: 'site' as const,
        label: entry.domain,
        detail: `${entry.count} 项`,
        insertText: `site:${entry.domain}`,
        score: usageBonus(entry.count),
      })),
      ...quickSuggestions('', 4),
    ];
  }

  return [
    ...tagSuggestions(query, context),
    ...siteSuggestions(query, context, 3),
    ...recentSuggestions(query, context, 3),
    ...quickSuggestions(query, 4),
  ];
}

/**
 * Suggest recovery actions for an empty result set.
 */
export function getNoResultActions(
  parsed: ParsedMediaQuery,
  context: MediaSearchSuggestionContext
): NoResultAction[] {
  const actions: NoResultAction[] = parsed.chips.slice(0, 3).map((chip) => ({
    id: `remove:${chip.id}`,
    label: `去掉「${chip.label}」`,
    nextQuery: removeMediaSearchChip(parsed.raw, chip),
  }));

  if (parsed.raw.trim()) {
    actions.push({ id: 'clear-all', label: '清除全部条件', nextQuery: '' });
  }

  const firstTerm = parsed.terms[0];
  if (firstTerm) {
    const token = tokenizeMediaQuery(parsed.raw).find((entry) => entry.text === firstTerm);
    const matches = [
      ...tagSuggestions(firstTerm, context, 2),
      ...siteSuggestions(firstTerm, context, 1),
    ];
    for (const match of matches) {
      actions.push({
        id: `try:${match.id}`,
        label: `试试 ${match.insertText}`,
        nextQuery: token
          ? applyMediaSearchSuggestion(parsed.raw, token, match.insertText)
          : match.insertText,
      });
    }
  }

  return actions.slice(0, 5);
}
