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
  'video:assembling': '视频缓冲中',
  'video:complete': '视频完整捕获',
  'video:skipped': '视频已跳过',
  ai: 'AI 状态',
};

export const EVENT_ICONS: Record<SessionEventKind, string> = {
  saved: '✅',
  duplicate: '♻️',
  skipped: '⏭',
  failed: '❌',
  'video:candidate': '🎬',
  'video:result': '🎞',
  'video:assembling': '🧩',
  'video:complete': '🎞',
  'video:skipped': '⚠️',
  ai: '🏷',
};

const VIDEO_SKIP_REASON_LABELS: Record<string, string> = {
  playlist: '播放列表或分片',
  'in-memory': '内存媒体（MSE）',
  'unverified-source': '无法确认是渐进式来源',
  'unknown-total': '无法确定文件总大小',
  'total-mismatch': '资源总大小不一致',
  'size-limit': '大小不符合限制',
  truncated: '响应字节不完整',
  aborted: '请求被中断',
  'body-unavailable': '无法读取响应体',
  incomplete: '未完整缓冲',
  capacity: '并发组装任务已满',
};

export type EventFilter = 'all' | 'saved' | 'duplicate' | 'skipped' | 'failed' | 'video' | 'ai';

export function matchesEventFilter(event: SessionEvent, filter: EventFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'video') {
    return (
      event.kind === 'video:candidate' ||
      event.kind === 'video:result' ||
      event.kind === 'video:assembling' ||
      event.kind === 'video:complete' ||
      event.kind === 'video:skipped'
    );
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
    case 'video:assembling': {
      const base = `缓冲中 ${formatBytes(event.receivedBytes ?? 0)} / ${formatBytes(
        event.totalBytes ?? 0
      )}`;
      if (!event.detail) return base;
      if (event.detail.startsWith('hint=reload-page')) {
        return `${base} · 该视频在开始捕获前已缓冲，请刷新页面后重播`;
      }
      if (event.detail.startsWith('hint=filling-head')) {
        return `${base} · 正在补齐捕获前已缓冲的头部`;
      }
      if (event.detail.startsWith('fill-gaps=start')) {
        return `${base} · 正在补齐缺失区间…`;
      }
      if (event.detail.startsWith('fill-gaps=done')) {
        return `${base} · 缺失区间已补齐`;
      }
      if (event.detail.startsWith('fill-gaps=failed')) {
        const reason = event.detail.slice('fill-gaps=failed'.length).trim();
        return `${base} · 补齐缺失区间失败${reason ? `：${reason}` : ''}`;
      }
      return `${base} · ${event.detail}`;
    }
    case 'video:complete':
      if (event.duplicate) return '视频内容已存在';
      return `视频完整捕获 · ${formatBytes(event.size ?? 0)}`;
    case 'video:skipped': {
      const label = VIDEO_SKIP_REASON_LABELS[event.reason ?? ''] ?? event.reason ?? '未完整捕获';
      const detail = event.detail ? ` · ${event.detail}` : '';
      if (event.missingBytes && event.missingBytes > 0) {
        return `${label} · 缺少 ${formatBytes(event.missingBytes)}${detail}`;
      }
      if (event.reason === 'incomplete') {
        return `${label}（开始捕获前已加载的内容无法补抓）${detail}`;
      }
      return `${label}${detail}`;
    }
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
