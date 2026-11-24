import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type SyntheticEvent,
} from 'react';
import {
  Alert,
  Button,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
  type InputRef,
} from 'antd';
import {
  getSourceDomains,
  listTags,
  reconnectVFS,
  refreshTask,
  setFileStarred,
  type SourceDomainCount,
  type VFSTagRecord,
} from '../../../shared/extension-runtime';
import { MediaDetail, VirtualMasonryGrid } from '../../media-browser/components';
import {
  useBackgroundMessaging,
  useCombinedMedia,
  useHistoricalImages,
  useTheme,
  type BackgroundEvent,
  type CombinedMediaItem,
} from '../../media-browser/hooks';
import { appStyles } from '../../media-browser/styles';
import { buildVfsDownloadUrl } from '../../media-browser/utils/media';
import {
  ExportCancelledError,
  ExportLimitError,
  exportMedia,
  type ExportProgress,
} from '../media-export';
import {
  applyMediaSearchSuggestion,
  clearRecentSearches,
  findActiveMediaQueryToken,
  loadRecentSearches,
  parseMediaQuery,
  removeMediaSearchChip,
  saveRecentSearch,
  type MediaSearchChip,
} from '../media-search-query';
import {
  getMediaSearchSuggestions,
  getNoResultActions,
  type MediaSearchSuggestion,
  type MediaSearchSuggestionKind,
} from '../media-search-suggestions';
import styles from './MediaLibrary.module.css';
import type { LibraryView } from '../tabs';

const { Text, Title } = Typography;

type SortValue =
  | 'captured_at:desc'
  | 'captured_at:asc'
  | 'size:desc'
  | 'size:asc'
  | 'confidence:desc'
  | 'ai_filename:asc';

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'captured_at:desc', label: '最新优先' },
  { value: 'captured_at:asc', label: '最早优先' },
  { value: 'size:desc', label: '最大优先' },
  { value: 'size:asc', label: '最小优先' },
  { value: 'confidence:desc', label: '置信度最高' },
  { value: 'ai_filename:asc', label: '文件名 A–Z' },
];

const VIEW_STORAGE_KEY = 'media-library-query-v1';
const LEGACY_STORAGE_KEY = 'media-library-filters-v1';

const SUGGESTION_GROUP_LABELS: Record<MediaSearchSuggestionKind, string> = {
  tag: '标签',
  site: '站点',
  type: '类型',
  status: '状态',
  date: '时间',
  starred: '筛选',
  recent: '最近搜索',
  quick: '快捷筛选',
};

interface StoredView {
  rawQuery: string;
  sort: SortValue;
}

function isSortValue(value: unknown): value is SortValue {
  return SORT_OPTIONS.some((option) => option.value === value);
}

function tagToken(name: string): string {
  return /\s/.test(name) ? `tag:"${name.replace(/"/g, '')}"` : `tag:${name}`;
}

function migrateLegacyFilters(raw: string): StoredView | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    const tokens: string[] = [];

    if (typeof parsed.q === 'string' && parsed.q.trim()) {
      tokens.push(parsed.q.trim());
    }

    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((tag): tag is string => typeof tag === 'string')
      : [];
    if (tags.length > 1 && parsed.tagMode === 'or') {
      tokens.push(`tag:${tags.join('|')}`);
    } else {
      for (const tag of tags) tokens.push(tagToken(tag));
    }

    if (tags.length === 0 && typeof parsed.activeTag === 'string' && parsed.activeTag !== 'all') {
      const name = parsed.activeTag.startsWith('system:')
        ? parsed.activeTag.slice('system:'.length)
        : parsed.activeTag;
      tokens.push(tagToken(name));
    }

    if (parsed.mimeType === 'image' || parsed.mimeType === 'video') {
      tokens.push(`type:${parsed.mimeType}`);
    }
    if (typeof parsed.sourceDomain === 'string' && parsed.sourceDomain) {
      tokens.push(`site:${parsed.sourceDomain}`);
    }
    if (
      parsed.datePreset === 'today' ||
      parsed.datePreset === '7d' ||
      parsed.datePreset === '30d' ||
      parsed.datePreset === '90d'
    ) {
      tokens.push(`date:${parsed.datePreset}`);
    }
    if (parsed.starred === true) {
      tokens.push('starred');
    }
    if (typeof parsed.classifyStatus === 'string' && parsed.classifyStatus) {
      tokens.push(`status:${parsed.classifyStatus}`);
    }

    return {
      rawQuery: tokens.join(' ').trim(),
      sort: isSortValue(parsed.sort) ? parsed.sort : 'captured_at:desc',
    };
  } catch {
    return null;
  }
}

function loadInitialView(): StoredView {
  try {
    const stored = sessionStorage.getItem(VIEW_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<StoredView>;
      return {
        rawQuery: typeof parsed.rawQuery === 'string' ? parsed.rawQuery : '',
        sort: isSortValue(parsed.sort) ? parsed.sort : 'captured_at:desc',
      };
    }
  } catch {
    // Fall through to the legacy view or defaults.
  }

  try {
    const legacy = sessionStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const migrated = migrateLegacyFilters(legacy);
      if (migrated) {
        sessionStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(migrated));
        sessionStorage.removeItem(LEGACY_STORAGE_KEY);
        return migrated;
      }
    }
  } catch {
    // Ignore malformed legacy state.
  }

  return { rawQuery: '', sort: 'captured_at:desc' };
}

function splitSort(sort: SortValue): {
  orderBy: 'captured_at' | 'size' | 'confidence' | 'ai_filename';
  order: 'asc' | 'desc';
} {
  const [orderBy, order] = sort.split(':') as [
    'captured_at' | 'size' | 'confidence' | 'ai_filename',
    'asc' | 'desc',
  ];
  return { orderBy, order };
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      results.push(await worker(current));
    }
  });
  await Promise.all(runners);
  return results;
}

function suggestionLabel(suggestion: MediaSearchSuggestion): string {
  switch (suggestion.kind) {
    case 'tag':
      return `# ${suggestion.label}`;
    case 'site':
      return `🌐 ${suggestion.label}`;
    case 'recent':
      return `🕘 ${suggestion.label}`;
    case 'type':
      return `🖼 ${suggestion.label}`;
    case 'status':
      return `⚙ ${suggestion.label}`;
    case 'date':
      return `🕒 ${suggestion.label}`;
    case 'starred':
      return `⭐ ${suggestion.label}`;
    case 'quick':
      return `⚡ ${suggestion.label}`;
  }
}

const TRASH_REFRESH_EVENTS = new Set([
  'file:trashed',
  'file:restored',
  'file:purged',
  'trash:emptied',
  'trash:restored-all',
]);

interface MediaLibraryProps {
  view?: LibraryView;
  onViewChange?: (view: LibraryView) => void;
}

interface TrashStats {
  files: number;
  size: number;
}

/**
 * Global media library for the Options console.
 *
 * Owns browse, search, curation, export, and the trash view. Capture control
 * and the live session cockpit stay in the Side Panel.
 */
export function MediaLibrary({ view = 'active', onViewChange }: MediaLibraryProps) {
  const isTrash = view === 'trash';
  const [initialView] = useState(loadInitialView);
  const [queryDraft, setQueryDraft] = useState(initialView.rawQuery);
  const [rawQuery, setRawQuery] = useState(initialView.rawQuery);
  const [sort, setSort] = useState<SortValue>(initialView.sort);
  const [cursor, setCursor] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<InputRef>(null);

  const [selectedItem, setSelectedItem] = useState<CombinedMediaItem | null>(null);
  const [loadedView, setLoadedView] = useState<LibraryView>(view);
  const [tagVocabulary, setTagVocabulary] = useState<VFSTagRecord[]>([]);
  const [sourceDomains, setSourceDomains] = useState<SourceDomainCount[]>([]);
  const [trashStats, setTrashStats] = useState<TrashStats>({ files: 0, size: 0 });
  const [trashBusy, setTrashBusy] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);
  const trashRefreshTimerRef = useRef<number | null>(null);
  const refreshHistoricalRef = useRef<() => void>(() => {});
  const refreshTrashStatsRef = useRef<() => void>(() => {});
  const theme = useTheme();

  const parsed = useMemo(() => parseMediaQuery(rawQuery), [rawQuery]);
  const suggestionContext = useMemo(
    () => ({ tags: tagVocabulary, domains: sourceDomains, recentSearches }),
    [tagVocabulary, sourceDomains, recentSearches]
  );
  const activeToken = useMemo(
    () => findActiveMediaQueryToken(queryDraft, cursor ?? queryDraft.length),
    [queryDraft, cursor]
  );
  const suggestions = useMemo(
    () => (composing ? [] : getMediaSearchSuggestions(activeToken.text, suggestionContext)),
    [composing, activeToken.text, suggestionContext]
  );
  const suggestionKey = suggestions.map((suggestion) => suggestion.id).join('|');
  const suggestionsVisible = focused && !dismissed && suggestions.length > 0;
  const safeHighlighted = Math.min(highlighted, Math.max(suggestions.length - 1, 0));
  const noResultActions = useMemo(
    () => getNoResultActions(parsed, suggestionContext),
    [parsed, suggestionContext]
  );

  useEffect(() => {
    setHighlighted(0);
  }, [suggestionKey]);

  useEffect(() => {
    void loadRecentSearches().then(setRecentSearches);
  }, []);

  useEffect(() => {
    if (composing) return;
    const timer = setTimeout(() => setRawQuery(queryDraft), 250);
    return () => clearTimeout(timer);
  }, [queryDraft, composing]);

  useEffect(() => {
    try {
      sessionStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ rawQuery, sort }));
    } catch {
      // The library still works when session storage is unavailable.
    }
  }, [rawQuery, sort]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const focusShortcut =
        (event.key === '/' && !inField) ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k');
      if (!focusShortcut) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadTags = useCallback(async () => {
    try {
      const tags = await listTags({ limit: 500 });
      setTagVocabulary(Array.isArray(tags) ? tags : []);
    } catch (error) {
      console.error('[MediaLibrary] Failed to load tag vocabulary:', error);
    }
  }, []);

  const handleBackgroundEvent = useCallback(
    (event: BackgroundEvent) => {
      if (event.type === 'tags:updated') {
        const data = event.data as { tags?: unknown } | null | undefined;
        if (Array.isArray(data?.tags)) {
          setTagVocabulary(data.tags as VFSTagRecord[]);
          return;
        }
        // Legacy payload-less event: fall back to one debounced fetch.
        void loadTags();
        return;
      }

      if (!TRASH_REFRESH_EVENTS.has(event.type)) return;

      if (!isTrash) {
        refreshTrashStatsRef.current();
        return;
      }

      if (trashRefreshTimerRef.current !== null) {
        window.clearTimeout(trashRefreshTimerRef.current);
      }
      trashRefreshTimerRef.current = window.setTimeout(() => {
        trashRefreshTimerRef.current = null;
        refreshHistoricalRef.current();
        refreshTrashStatsRef.current();
      }, 200);
    },
    [isTrash, loadTags]
  );

  const { events, vfsConnected, sendMessage } = useBackgroundMessaging({
    collectEvents: !isTrash,
    onEvent: handleBackgroundEvent,
  });

  const loadTrashStats = useCallback(async () => {
    try {
      const response = (await sendMessage({ type: 'getStats' })) as
        | { success?: boolean; data?: { trashSize?: number; trashFiles?: number } }
        | { trashSize?: number; trashFiles?: number }
        | null;
      const data = response && 'data' in response && response.data ? response.data : response;
      setTrashStats({
        files: (data as { trashFiles?: number } | null)?.trashFiles ?? 0,
        size: (data as { trashSize?: number } | null)?.trashSize ?? 0,
      });
    } catch (error) {
      console.error('[MediaLibrary] Failed to load trash statistics:', error);
    }
  }, [sendMessage]);

  useEffect(() => {
    refreshTrashStatsRef.current = () => void loadTrashStats();
  }, [loadTrashStats]);

  useEffect(() => {
    return () => {
      if (trashRefreshTimerRef.current !== null) {
        window.clearTimeout(trashRefreshTimerRef.current);
      }
    };
  }, []);

  const { orderBy, order } = splitSort(sort);
  const historical = useHistoricalImages({
    limit: 50,
    autoLoad: true,
    terms: parsed.terms.length > 0 ? parsed.terms : undefined,
    excludeTerms: parsed.excludeTerms.length > 0 ? parsed.excludeTerms : undefined,
    tags: parsed.tags.length > 0 ? parsed.tags : undefined,
    tagMode: parsed.tags.length > 0 ? 'and' : undefined,
    tagGroups: parsed.tagGroups.length > 0 ? parsed.tagGroups : undefined,
    sourceDomains: parsed.sourceDomains.length > 0 ? parsed.sourceDomains : undefined,
    mimeType: parsed.mimeType,
    capturedFrom: parsed.capturedFrom,
    capturedTo: parsed.capturedTo,
    starred: parsed.starred,
    classifyStatus: parsed.classifyStatus,
    status: isTrash ? 'trashed' : 'active',
    orderBy: isTrash ? 'deleted_at' : orderBy,
    order: isTrash ? 'desc' : order,
  });

  useEffect(() => {
    refreshHistoricalRef.current = historical.refresh;
  }, [historical.refresh]);

  const hasAppliedQuery = parsed.chips.length > 0;
  const hasQueryText = rawQuery.trim().length > 0;
  const liveEvents = useMemo(
    () => (!isTrash && !hasAppliedQuery ? events : []),
    [isTrash, hasAppliedQuery, events]
  );

  const combinedMedia = useCombinedMedia({
    historicalItems: historical.items,
    backgroundEvents: liveEvents,
  });

  const viewReady = loadedView === view;
  const filteredMedia = viewReady ? combinedMedia.items : [];
  const total = viewReady
    ? historical.total + (!isTrash && !hasAppliedQuery ? combinedMedia.newItemCount : 0)
    : 0;
  const trashCount = isTrash ? total : trashStats.files;

  const loadSourceDomains = useCallback(async () => {
    try {
      const domains = await getSourceDomains(100);
      setSourceDomains(Array.isArray(domains) ? domains : []);
    } catch (error) {
      console.error('[MediaLibrary] Failed to load source domains:', error);
    }
  }, []);

  useEffect(() => {
    void loadTags();
    void loadSourceDomains();
    void loadTrashStats();
  }, [loadTags, loadSourceDomains, loadTrashStats]);

  const filterSignature = `${view}\u0000${rawQuery}\u0000${sort}`;
  useEffect(() => {
    setSelectedHashes(new Set());
  }, [filterSignature]);

  useEffect(() => {
    setLoadedView(view);
    setSelectionMode(false);
    setSelectedHashes(new Set());
    setSelectedItem(null);
  }, [view]);

  const prevConnectedRef = useRef<boolean | null>(null);
  const refreshHistorical = historical.refresh;
  useEffect(() => {
    const previous = prevConnectedRef.current;
    if (previous !== null && !previous && vfsConnected) {
      refreshHistorical();
      void loadTags();
      void loadSourceDomains();
    }
    prevConnectedRef.current = vfsConnected;
  }, [vfsConnected, refreshHistorical, loadTags, loadSourceDomains]);

  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  useEffect(() => {
    if (isTrash || !hasAppliedQuery || !lastEvent) return;
    if (
      ![
        'file:captured',
        'file:trashed',
        'file:restored',
        'classify:complete',
        'file:classified',
        'rename:complete',
        'task:completed',
      ].includes(lastEvent.type)
    ) {
      return;
    }
    const timer = setTimeout(() => refreshHistorical(), 500);
    return () => clearTimeout(timer);
  }, [isTrash, hasAppliedQuery, lastEvent, refreshHistorical]);

  useEffect(() => {
    if (!selectedItem) return;
    const next = filteredMedia.find((item) => item.hash === selectedItem.hash);
    if (!next) {
      setSelectedItem(null);
      return;
    }
    if (next !== selectedItem) {
      setSelectedItem(next);
    }
  }, [filteredMedia, selectedItem]);

  const handleRefreshTask = useCallback((taskType: 'classify' | 'rename', hash: string) => {
    refreshTask(taskType, hash)
      .then((result) => {
        if (!result.success && result.reason) {
          message.warning(result.reason);
        }
      })
      .catch((error) => {
        console.error(`[MediaLibrary] Failed to requeue ${taskType} for ${hash}:`, error);
      });
  }, []);

  const handleDelete = useCallback(
    async (hash: string) => {
      try {
        await sendMessage({ type: 'trashFile', hash });
        if (selectedItem?.hash === hash) setSelectedItem(null);
        void loadTags();
        void loadTrashStats();
      } catch (error) {
        console.error('[MediaLibrary] Failed to move item to trash:', error);
        message.error('移入回收站失败');
      }
    },
    [selectedItem, sendMessage, loadTags, loadTrashStats]
  );

  const requestDelete = useCallback(
    (hash: string) => {
      Modal.confirm({
        title: '移入回收站',
        content: '删除后将从媒体库移除并移入回收站，可稍后恢复或永久删除。确定继续吗？',
        okText: '移入回收站',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => handleDelete(hash),
      });
    },
    [handleDelete]
  );

  const handleRestore = useCallback(
    async (hash: string) => {
      try {
        const result = await sendMessage({ type: 'restoreFile', hash });
        if (!rpcSucceeded(result)) {
          message.error('恢复失败');
          return;
        }
        if (selectedItem?.hash === hash) setSelectedItem(null);
        refreshHistorical();
        void loadTrashStats();
        message.success('已恢复');
      } catch (error) {
        console.error('[MediaLibrary] Failed to restore item:', error);
        message.error('恢复失败');
      }
    },
    [selectedItem, sendMessage, refreshHistorical, loadTrashStats]
  );

  const handlePurge = useCallback(
    async (hash: string) => {
      setTrashBusy(true);
      try {
        const result = await sendMessage({ type: 'purgeFile', hash });
        if (!rpcSucceeded(result)) {
          message.error('永久删除失败');
          return;
        }
        if (selectedItem?.hash === hash) setSelectedItem(null);
        refreshHistorical();
        void loadTrashStats();
        message.success('已永久删除');
      } catch (error) {
        console.error('[MediaLibrary] Failed to purge item:', error);
        message.error('永久删除失败');
      } finally {
        setTrashBusy(false);
      }
    },
    [selectedItem, sendMessage, refreshHistorical, loadTrashStats]
  );

  const requestPurge = useCallback(
    (hash: string) => {
      Modal.confirm({
        title: '永久删除',
        content: '该媒体将从磁盘永久删除，归档副本也会被删除，且无法恢复。确定继续吗？',
        okText: '永久删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => handlePurge(hash),
      });
    },
    [handlePurge]
  );

  const handleRestoreAll = useCallback(() => {
    if (total === 0) return;
    Modal.confirm({
      title: '恢复全部',
      content: `将恢复回收站中的全部 ${total} 个媒体。确定继续吗？`,
      okText: '恢复全部',
      cancelText: '取消',
      onOk: async () => {
        setTrashBusy(true);
        try {
          const result = (await sendMessage({ type: 'restoreAll' })) as {
            success?: boolean;
            count?: number;
          } | null;
          if (!result?.success) {
            message.error('恢复全部失败');
            return;
          }
          refreshHistorical();
          void loadTrashStats();
          message.success(`已恢复 ${result.count ?? 0} 个媒体`);
        } catch (error) {
          console.error('[MediaLibrary] Failed to restore all:', error);
          message.error('恢复全部失败');
        } finally {
          setTrashBusy(false);
        }
      },
    });
  }, [total, sendMessage, refreshHistorical, loadTrashStats]);

  const handleEmptyTrash = useCallback(() => {
    if (total === 0) return;
    Modal.confirm({
      title: '清空回收站',
      content: `将永久删除回收站中的全部 ${total} 个媒体，归档副本也会被删除，且无法恢复。确定继续吗？`,
      okText: '清空回收站',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setTrashBusy(true);
        try {
          const result = (await sendMessage({ type: 'emptyTrash' })) as {
            success?: boolean;
            count?: number;
          } | null;
          if (!result?.success) {
            message.error('清空回收站失败');
            return;
          }
          refreshHistorical();
          void loadTrashStats();
          message.success(`已永久删除 ${result.count ?? 0} 个媒体`);
        } catch (error) {
          console.error('[MediaLibrary] Failed to empty trash:', error);
          message.error('清空回收站失败');
        } finally {
          setTrashBusy(false);
        }
      },
    });
  }, [total, sendMessage, refreshHistorical, loadTrashStats]);

  const toggleSelect = useCallback((hash: string) => {
    setSelectedHashes((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  }, []);

  const selectedItems = useMemo(
    () => filteredMedia.filter((item) => selectedHashes.has(item.hash)),
    [filteredMedia, selectedHashes]
  );

  const handleBulkTrash = useCallback(() => {
    if (selectedItems.length === 0) return;
    Modal.confirm({
      title: '批量移入回收站',
      content: `确定将 ${selectedItems.length} 项移入回收站吗？它们可以稍后恢复。`,
      okText: '移入回收站',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        let failed = 0;
        await mapLimit(selectedItems, 4, async (item) => {
          try {
            await sendMessage({ type: 'trashFile', hash: item.hash });
          } catch (error) {
            failed += 1;
            console.error('[MediaLibrary] Batch trash failed:', item.hash, error);
          }
        });
        setSelectedHashes(new Set());
        void loadTags();
        void loadTrashStats();
        if (failed > 0) {
          message.warning(`${failed} 项移入回收站失败`);
        } else {
          message.success(`已移入回收站 ${selectedItems.length} 项`);
        }
      },
    });
  }, [selectedItems, sendMessage, loadTags, loadTrashStats]);

  const handleBulkRequeue = useCallback(
    async (taskType: 'classify' | 'rename') => {
      if (selectedItems.length === 0) return;
      let failed = 0;
      await mapLimit(selectedItems, 4, async (item) => {
        try {
          const result = await refreshTask(taskType, item.hash);
          if (!result.success && !result.skipped) failed += 1;
        } catch (error) {
          failed += 1;
          console.error('[MediaLibrary] Batch requeue failed:', item.hash, error);
        }
      });
      if (failed > 0) {
        message.warning(`${failed} 项重新入队失败`);
      } else {
        message.success(`已重新入队 ${selectedItems.length} 项`);
      }
    },
    [selectedItems]
  );

  const handleBulkRestore = useCallback(() => {
    if (selectedItems.length === 0) return;
    Modal.confirm({
      title: '恢复选中的媒体',
      content: `将恢复选中的 ${selectedItems.length} 个媒体。确定继续吗？`,
      okText: '恢复',
      cancelText: '取消',
      onOk: async () => {
        setTrashBusy(true);
        let failed = 0;
        try {
          await mapLimit(selectedItems, 4, async (item) => {
            try {
              const result = await sendMessage({ type: 'restoreFile', hash: item.hash });
              if (!rpcSucceeded(result)) failed += 1;
            } catch (error) {
              failed += 1;
              console.error('[MediaLibrary] Batch restore failed:', item.hash, error);
            }
          });
          setSelectedHashes(new Set());
          refreshHistorical();
          void loadTrashStats();
          if (failed > 0) message.warning(`${failed} 个媒体恢复失败`);
          else message.success(`已恢复 ${selectedItems.length} 个媒体`);
        } finally {
          setTrashBusy(false);
        }
      },
    });
  }, [selectedItems, sendMessage, refreshHistorical, loadTrashStats]);

  const handleBulkPurge = useCallback(() => {
    if (selectedItems.length === 0) return;
    Modal.confirm({
      title: '永久删除选中的媒体',
      content: `将永久删除选中的 ${selectedItems.length} 个媒体及其归档副本，且无法恢复。确定继续吗？`,
      okText: '永久删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setTrashBusy(true);
        let failed = 0;
        try {
          await mapLimit(selectedItems, 4, async (item) => {
            try {
              const result = await sendMessage({ type: 'purgeFile', hash: item.hash });
              if (!rpcSucceeded(result)) failed += 1;
            } catch (error) {
              failed += 1;
              console.error('[MediaLibrary] Batch purge failed:', item.hash, error);
            }
          });
          setSelectedHashes(new Set());
          refreshHistorical();
          void loadTrashStats();
          if (failed > 0) message.warning(`${failed} 个媒体永久删除失败`);
          else message.success(`已永久删除 ${selectedItems.length} 个媒体`);
        } finally {
          setTrashBusy(false);
        }
      },
    });
  }, [selectedItems, sendMessage, refreshHistorical, loadTrashStats]);

  const handleBulkExport = useCallback(async () => {
    if (selectedItems.length === 0) return;
    const controller = new AbortController();
    exportAbortRef.current = controller;
    setExporting(true);
    setExportProgress({ completed: 0, total: selectedItems.length, currentName: '' });
    try {
      const result = await exportMedia(selectedItems, {
        signal: controller.signal,
        onProgress: setExportProgress,
      });
      const failureText =
        result.failures.length > 0 ? `，${result.failures.length} 项读取失败` : '';
      message.success(`已导出 ${result.exported} 项${failureText}`);
    } catch (error) {
      if (error instanceof ExportCancelledError) {
        message.info('已取消导出');
      } else if (error instanceof ExportLimitError) {
        message.warning(error.message);
      } else {
        const text = error instanceof Error ? error.message : '导出失败';
        message.error(text);
      }
    } finally {
      setExporting(false);
      setExportProgress(null);
      exportAbortRef.current = null;
    }
  }, [selectedItems]);

  const handleCancelExport = useCallback(() => {
    exportAbortRef.current?.abort();
  }, []);

  const handleToggleStar = useCallback(
    async (hash: string, starred: boolean) => {
      try {
        await setFileStarred(hash, starred);
        historical.updateItem(hash, { isStarred: starred });
        void loadTags();
      } catch (error) {
        console.error('[MediaLibrary] Failed to update star state:', error);
        message.error('更新收藏状态失败');
      }
    },
    [historical, loadTags]
  );

  const handleNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (!selectedItem) return;
      const index = filteredMedia.findIndex((item) => item.hash === selectedItem.hash);
      if (index < 0) return;
      const nextIndex = direction === 'prev' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= filteredMedia.length) return;
      setSelectedItem(filteredMedia[nextIndex]);
    },
    [filteredMedia, selectedItem]
  );

  const selectedIndex = selectedItem
    ? filteredMedia.findIndex((item) => item.hash === selectedItem.hash)
    : -1;

  const themeClass = theme.themeClass(appStyles.lightTheme, appStyles.darkTheme);
  const showInitialLoading = (!viewReady || historical.loading) && filteredMedia.length === 0;

  const applyQuery = useCallback((next: string, options: { saveRecent?: boolean } = {}) => {
    setQueryDraft(next);
    setRawQuery(next);
    setDismissed(true);
    if (options.saveRecent && next.trim()) {
      void saveRecentSearch(next).then(setRecentSearches);
    }
  }, []);

  const handleQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQueryDraft(event.target.value);
    setCursor(event.target.selectionStart ?? null);
    setDismissed(false);
  }, []);

  const handleCursorUpdate = useCallback((event: SyntheticEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    setCursor(input.selectionStart ?? null);
  }, []);

  const applySuggestion = useCallback(
    (suggestion: MediaSearchSuggestion) => {
      const next = applyMediaSearchSuggestion(
        queryDraft,
        activeToken,
        suggestion.insertText,
        suggestion.replaceAll
      );
      applyQuery(next, { saveRecent: true });
      window.requestAnimationFrame(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        input.setSelectionRange(next.length, next.length);
      });
    },
    [activeToken, applyQuery, queryDraft]
  );

  const commitQuery = useCallback(() => {
    applyQuery(queryDraft, { saveRecent: true });
  }, [applyQuery, queryDraft]);

  const clearQuery = useCallback(() => {
    setQueryDraft('');
    setRawQuery('');
    setDismissed(true);
  }, []);

  const removeChip = useCallback(
    (chip: MediaSearchChip) => {
      const next = removeMediaSearchChip(rawQuery, chip);
      setQueryDraft(next);
      setRawQuery(next);
    },
    [rawQuery]
  );

  const handleClearRecentSearches = useCallback(() => {
    void clearRecentSearches();
    setRecentSearches([]);
  }, []);

  const handleSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (composing) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setDismissed(false);
        setHighlighted((index) => Math.min(index + 1, Math.max(suggestions.length - 1, 0)));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlighted((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === 'Enter') {
        if (suggestionsVisible && suggestions[safeHighlighted]) {
          event.preventDefault();
          applySuggestion(suggestions[safeHighlighted]);
        } else {
          commitQuery();
        }
        return;
      }
      if (event.key === 'Tab') {
        if (suggestionsVisible && suggestions[safeHighlighted]) {
          event.preventDefault();
          applySuggestion(suggestions[safeHighlighted]);
        }
        return;
      }
      if (event.key === 'Escape') {
        if (suggestionsVisible) {
          event.preventDefault();
          setDismissed(true);
        } else if (queryDraft) {
          event.preventDefault();
          clearQuery();
        }
      }
    },
    [
      applySuggestion,
      clearQuery,
      commitQuery,
      composing,
      queryDraft,
      safeHighlighted,
      suggestions,
      suggestionsVisible,
    ]
  );

  return (
    <div className={styles.library}>
      <div className={styles.header}>
        <div>
          <Title level={4} className={styles.title}>
            {isTrash ? '回收站' : '媒体库'}
          </Title>
          <Text type="secondary">
            {isTrash
              ? '移入回收站的媒体会保留原始文件和归档副本，可随时恢复或永久删除。'
              : '全局浏览、搜索和管理所有已捕获的图片与视频。捕获会话仍在侧边栏中进行。'}
          </Text>
        </div>
        <Space wrap>
          <Segmented
            value={view}
            onChange={(value) => onViewChange?.(value as LibraryView)}
            options={[
              { label: '媒体库', value: 'active' },
              {
                label: trashCount > 0 ? `回收站 (${trashCount})` : '回收站',
                value: 'trash',
              },
            ]}
          />
          <Tag>共 {total} 个</Tag>
          {isTrash && trashStats.size > 0 && <Tag>占用 {formatSize(trashStats.size)}</Tag>}
          <Tag color={vfsConnected ? 'green' : 'red'}>
            {vfsConnected ? 'VFS 已连接' : 'VFS 未连接'}
          </Tag>
          {isTrash && (
            <>
              <Button size="small" onClick={handleRestoreAll} disabled={trashBusy || total === 0}>
                恢复全部
              </Button>
              <Button
                size="small"
                danger
                onClick={handleEmptyTrash}
                disabled={trashBusy || total === 0}
              >
                清空回收站
              </Button>
            </>
          )}
        </Space>
      </div>

      {!vfsConnected && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="VFS 未连接"
          description="当前列表可能不是最新数据。请先启动本地服务，然后重连。"
          action={
            <Button size="small" onClick={() => void reconnectVFS()}>
              重连
            </Button>
          }
        />
      )}

      {historical.error && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} message={historical.error} />
      )}

      <div className={`${appStyles.panel} ${themeClass} ${styles.mediaSurface}`}>
        <div className={styles.searchRow}>
          <div className={styles.searchWrap}>
            <Input
              ref={inputRef}
              allowClear
              value={queryDraft}
              disabled={!vfsConnected}
              placeholder="搜索文件名、标签、站点、备注…"
              aria-label="搜索媒体"
              onChange={handleQueryChange}
              onKeyDown={handleSearchKeyDown}
              onKeyUp={handleCursorUpdate}
              onClick={handleCursorUpdate}
              onSelect={handleCursorUpdate}
              onFocus={() => {
                setFocused(true);
                setDismissed(false);
              }}
              onBlur={() => setFocused(false)}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={(event) => {
                setComposing(false);
                setQueryDraft(event.currentTarget.value);
                setCursor(event.currentTarget.selectionStart ?? null);
                setDismissed(false);
              }}
            />

            {suggestionsVisible && (
              <div
                className={styles.suggestions}
                role="listbox"
                aria-label="搜索建议"
                onMouseDown={(event) => event.preventDefault()}
              >
                {!queryDraft.trim() && (
                  <div className={styles.suggestionHeader}>
                    <span>推荐</span>
                    {recentSearches.length > 0 && (
                      <button
                        type="button"
                        className={styles.suggestionClear}
                        onClick={handleClearRecentSearches}
                      >
                        清空最近搜索
                      </button>
                    )}
                  </div>
                )}

                {suggestions.map((suggestion, index) => {
                  const showGroup = index === 0 || suggestions[index - 1].kind !== suggestion.kind;
                  return (
                    <Fragment key={suggestion.id}>
                      {showGroup && (
                        <div className={styles.suggestionGroup}>
                          {SUGGESTION_GROUP_LABELS[suggestion.kind]}
                        </div>
                      )}
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === safeHighlighted}
                        className={`${styles.suggestionItem} ${
                          index === safeHighlighted ? styles.suggestionActive : ''
                        }`}
                        onMouseEnter={() => setHighlighted(index)}
                        onClick={() => applySuggestion(suggestion)}
                      >
                        <span className={styles.suggestionLabel}>
                          {suggestionLabel(suggestion)}
                        </span>
                        {suggestion.detail && (
                          <span className={styles.suggestionDetail}>{suggestion.detail}</span>
                        )}
                      </button>
                    </Fragment>
                  );
                })}

                <div className={styles.suggestionFooter}>
                  ↑↓ 选择 · Enter 应用 · Tab 补全 · Esc 关闭 · 支持 tag: site: type: status: date:
                </div>
              </div>
            )}
          </div>

          {!isTrash && (
            <Select
              value={sort}
              options={SORT_OPTIONS}
              aria-label="排序"
              style={{ width: 132, flex: '0 0 132px' }}
              onChange={(value: SortValue) => setSort(value)}
            />
          )}
          <Button onClick={historical.refresh} loading={historical.loading}>
            刷新
          </Button>
          <Button
            disabled={!vfsConnected}
            onClick={() => {
              setSelectionMode((prev) => !prev);
              setSelectedHashes(new Set());
            }}
          >
            {selectionMode ? '退出选择' : '选择'}
          </Button>
        </div>

        {parsed.chips.length > 0 && (
          <div className={styles.appliedRow}>
            {parsed.chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={styles.chip}
                title={`移除：${chip.label}`}
                onClick={() => removeChip(chip)}
              >
                {chip.label}
                <span aria-hidden="true"> ×</span>
              </button>
            ))}
            <Button size="small" type="link" onClick={clearQuery}>
              清除全部
            </Button>
            <Text type="secondary" className={styles.resultCount}>
              找到 {total} 项
            </Text>
          </div>
        )}

        {selectionMode && (
          <div className={styles.selectionBar}>
            <Text strong>已选 {selectedHashes.size} 项</Text>
            <Button
              size="small"
              onClick={() => setSelectedHashes(new Set(filteredMedia.map((item) => item.hash)))}
            >
              全选当前 {filteredMedia.length} 项
            </Button>
            <Button size="small" onClick={() => setSelectedHashes(new Set())}>
              清空
            </Button>
            {isTrash ? (
              <>
                <Button
                  size="small"
                  disabled={!selectedHashes.size || trashBusy}
                  onClick={handleBulkRestore}
                >
                  恢复选中
                </Button>
                <Button
                  size="small"
                  danger
                  disabled={!selectedHashes.size || trashBusy}
                  onClick={handleBulkPurge}
                >
                  永久删除选中
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="small"
                  danger
                  disabled={!selectedHashes.size}
                  onClick={handleBulkTrash}
                >
                  移入回收站
                </Button>
                <Button
                  size="small"
                  disabled={!selectedHashes.size}
                  onClick={() => void handleBulkRequeue('classify')}
                >
                  重新分类
                </Button>
                <Button
                  size="small"
                  disabled={!selectedHashes.size}
                  onClick={() => void handleBulkRequeue('rename')}
                >
                  重新命名
                </Button>
                <Button
                  size="small"
                  type="primary"
                  disabled={!selectedHashes.size || exporting}
                  loading={exporting}
                  onClick={() => void handleBulkExport()}
                >
                  导出
                </Button>
                {exporting && (
                  <Button size="small" onClick={handleCancelExport}>
                    取消导出
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {exportProgress && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 8 }}
            message={`正在导出 ${exportProgress.completed}/${exportProgress.total}：${exportProgress.currentName}`}
          />
        )}

        {showInitialLoading ? (
          <div className={styles.loading}>
            <Spin tip={isTrash ? '加载回收站中…' : '加载媒体中…'} />
          </div>
        ) : (
          <VirtualMasonryGrid
            items={filteredMedia}
            onLoadMore={historical.loadMore}
            onItemClick={setSelectedItem}
            onItemDeleteRequest={isTrash ? requestPurge : requestDelete}
            hasMore={historical.hasMore}
            loading={historical.loading}
            selectionMode={selectionMode}
            selectedHashes={selectedHashes}
            onToggleSelect={toggleSelect}
            emptyMessage={
              isTrash ? '回收站是空的' : hasQueryText ? '没有匹配的媒体' : '还没有捕获媒体'
            }
            emptyAction={
              hasQueryText ? (
                <div className={styles.noResults}>
                  <Text type="secondary">试试去掉一个条件，或换一个关键词。</Text>
                  <Space wrap>
                    {noResultActions.map((action) => (
                      <Button
                        key={action.id}
                        size="small"
                        onClick={() => applyQuery(action.nextQuery)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </Space>
                </div>
              ) : isTrash ? (
                <Text type="secondary">移入回收站的媒体会出现在这里。</Text>
              ) : (
                <Text type="secondary">在侧边栏开始捕获后，媒体会出现在这里。</Text>
              )
            }
          />
        )}
      </div>

      {viewReady && selectedItem && isTrash && (
        <MediaDetail
          item={selectedItem}
          mode="trash"
          onClose={() => setSelectedItem(null)}
          onRestore={handleRestore}
          onPurgeRequest={requestPurge}
          onNavigate={handleNavigate}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex >= 0 && selectedIndex < filteredMedia.length - 1}
        />
      )}

      {viewReady && selectedItem && !isTrash && (
        <MediaDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDeleteRequest={requestDelete}
          onRefreshTask={handleRefreshTask}
          onToggleStar={handleToggleStar}
          onDownload={(item) => {
            void chrome.downloads.download({ url: buildVfsDownloadUrl(item.hash), saveAs: true });
          }}
          onNavigate={handleNavigate}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex >= 0 && selectedIndex < filteredMedia.length - 1}
        />
      )}
    </div>
  );
}

function rpcSucceeded(response: unknown): boolean {
  if (!response || typeof response !== 'object') return false;
  const record = response as {
    success?: boolean;
    data?: { success?: boolean } | null;
  };
  return record.data?.success ?? record.success ?? false;
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export default MediaLibrary;
