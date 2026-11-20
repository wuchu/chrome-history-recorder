import type {
  SessionEvent,
  SessionEventKind,
  SessionSummary,
} from '../../shared/extension-runtime';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString();
}

export const EVENT_LABELS: Record<SessionEventKind, string> = {
  saved: '已保存',
  duplicate: '已存在',
  skipped: '已跳过',
  failed: '失败',
  'video:candidate': '视频候选',
  'video:result': '视频完成',
  ai: 'AI 状态',
};

export const EVENT_ICONS: Record<SessionEventKind, string> = {
  saved: '✅',
  duplicate: '♻️',
  skipped: '⏭',
  failed: '❌',
  'video:candidate': '🎬',
  'video:result': '🎞',
  ai: '🏷',
};

export type EventFilter = 'all' | 'saved' | 'duplicate' | 'skipped' | 'failed' | 'video' | 'ai';

export function matchesEventFilter(event: SessionEvent, filter: EventFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'video') {
    return event.kind === 'video:candidate' || event.kind === 'video:result';
  }
  return event.kind === filter;
}

export function describeEvent(event: SessionEvent): string {
  switch (event.kind) {
    case 'saved':
      return `保存 ${event.mimeType ?? '媒体'} · ${formatBytes(event.size ?? 0)}`;
    case 'duplicate':
      return '内容已存在，未重复保存';
    case 'skipped':
      return event.reason ?? '不满足捕获条件';
    case 'failed':
      return event.error ?? '捕获失败';
    case 'video:candidate':
      return `检测到视频 · ${formatBytes(event.size ?? 0)}`;
    case 'video:result':
      if (event.error) return event.error;
      if (event.duplicate) return '视频内容已存在';
      return `视频已保存 · ${formatBytes(event.size ?? 0)}`;
    case 'ai':
      return event.aiStatus ? `AI ${event.aiStatus}` : 'AI 状态更新';
    default:
      return event.kind;
  }
}

export function summaryFromSession(
  summary: SessionSummary | null,
  session: {
    startedAt: string;
    endedAt?: string;
    tabTitle: string;
    pageUrl: string;
    counters: SessionSummary['counters'];
    error?: string;
  } | null
): SessionSummary | null {
  if (summary) return summary;
  if (!session) return null;
  const endedAt = session.endedAt ?? new Date().toISOString();
  return {
    sessionId: '',
    tabId: 0,
    tabTitle: session.tabTitle,
    pageUrl: session.pageUrl,
    startedAt: session.startedAt,
    endedAt,
    durationMs: Math.max(0, new Date(endedAt).getTime() - new Date(session.startedAt).getTime()),
    counters: session.counters,
    topReasons: [],
    error: session.error,
  };
}
