/**
 * App configuration types and defaults.
 */

import type { PromptTemplates } from 'ai';

export const MIN_VIDEO_SIZE_LIMIT = 1 * 1024 * 1024;
export const MAX_VIDEO_SIZE_LIMIT = 2 * 1024 * 1024 * 1024;
export const DEFAULT_MAX_VIDEO_SIZE = 200 * 1024 * 1024;
export const DEFAULT_ENABLED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
export const SUPPORTED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/ogg',
  'video/x-matroska',
];

export const MIN_MEDIA_ARCHIVE_INTERVAL_MINUTES = 1;
export const MAX_MEDIA_ARCHIVE_INTERVAL_MINUTES = 1440;
export const DEFAULT_MEDIA_ARCHIVE_INTERVAL_MINUTES = 5;

export const MIN_TASK_CONCURRENCY = 1;
export const MAX_TASK_CONCURRENCY = 8;
export const DEFAULT_TASK_CONCURRENCY = 1;

export type VideoCaptureMode = 'buffer-only' | 're-download';

export const DEFAULT_VIDEO_CAPTURE_MODE: VideoCaptureMode = 're-download';
export const DEFAULT_VIDEO_CAPTURE_MODE_BY_HOST: Record<string, VideoCaptureMode> = {
  'douyin.com': 'buffer-only',
  'douyinvod.com': 'buffer-only',
  'v.douyin.com': 'buffer-only',
};

const VIDEO_CAPTURE_MODES = new Set<VideoCaptureMode>(['buffer-only', 're-download']);
const MAX_VIDEO_CAPTURE_HOST_OVERRIDES = 100;

export interface AppConfig {
  ollamaEndpoint: string;
  visionModel?: string;
  language: string;
  promptTemplates?: PromptTemplates;
  ollamaMaxConcurrency: number;
  classifyConcurrency: number;
  renameConcurrency: number;
  classifyPaused: boolean;
  renamePaused: boolean;
  maxFileSize: number;
  captureVideos: boolean;
  maxVideoSize: number;
  enabledVideoTypes: string[];
  videoCaptureMode: VideoCaptureMode;
  videoCaptureModeByHost: Record<string, VideoCaptureMode>;
  videoAssemblyFillGaps: boolean;
  mediaArchiveEnabled: boolean;
  mediaArchiveTargetPath: string;
  mediaArchiveIntervalMinutes: number;
  mediaArchiveConcurrency: number;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  ollamaEndpoint: 'http://localhost:11434',
  language: 'zh-CN',
  ollamaMaxConcurrency: DEFAULT_TASK_CONCURRENCY,
  classifyConcurrency: DEFAULT_TASK_CONCURRENCY,
  renameConcurrency: DEFAULT_TASK_CONCURRENCY,
  classifyPaused: true,
  renamePaused: true,
  maxFileSize: 50 * 1024 * 1024,
  captureVideos: true,
  maxVideoSize: DEFAULT_MAX_VIDEO_SIZE,
  enabledVideoTypes: [...DEFAULT_ENABLED_VIDEO_TYPES],
  videoCaptureMode: DEFAULT_VIDEO_CAPTURE_MODE,
  videoCaptureModeByHost: { ...DEFAULT_VIDEO_CAPTURE_MODE_BY_HOST },
  videoAssemblyFillGaps: true,
  mediaArchiveEnabled: false,
  mediaArchiveTargetPath: '',
  mediaArchiveIntervalMinutes: DEFAULT_MEDIA_ARCHIVE_INTERVAL_MINUTES,
  mediaArchiveConcurrency: DEFAULT_TASK_CONCURRENCY,
};

/**
 * Legacy scheduling fields that existed before per-task controls. They are
 * read once during migration and never persisted again.
 */
export interface LegacySchedulingConfig {
  classificationConcurrency?: number;
  classificationPaused?: boolean;
}

export function normalizeConcurrency(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(MAX_TASK_CONCURRENCY, Math.max(MIN_TASK_CONCURRENCY, Math.floor(value)))
    : DEFAULT_TASK_CONCURRENCY;
}

export function normalizeVideoCaptureMode(
  value: unknown,
  fallback: VideoCaptureMode = DEFAULT_VIDEO_CAPTURE_MODE
): VideoCaptureMode {
  return typeof value === 'string' && VIDEO_CAPTURE_MODES.has(value as VideoCaptureMode)
    ? (value as VideoCaptureMode)
    : fallback;
}

/**
 * Normalize a host-suffix map. Invalid entries are dropped; a missing or
 * non-object value falls back to the built-in overrides.
 */
export function normalizeVideoCaptureModeByHost(value: unknown): Record<string, VideoCaptureMode> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_VIDEO_CAPTURE_MODE_BY_HOST };
  }

  const result: Record<string, VideoCaptureMode> = {};
  for (const [rawHost, rawMode] of Object.entries(value as Record<string, unknown>)) {
    if (Object.keys(result).length >= MAX_VIDEO_CAPTURE_HOST_OVERRIDES) break;
    if (typeof rawHost !== 'string') continue;
    const host = rawHost
      .trim()
      .toLowerCase()
      .replace(/^\*?\./, '');
    if (!host || host.length > 253) continue;
    if (typeof rawMode !== 'string' || !VIDEO_CAPTURE_MODES.has(rawMode as VideoCaptureMode)) {
      continue;
    }
    result[host] = rawMode as VideoCaptureMode;
  }
  return result;
}

/**
 * Map legacy global scheduling settings onto the new per-task fields. The
 * caller must run this before merging defaults so a persisted `false` is not
 * shadowed by a default `true`.
 */
export function migrateLegacyScheduling<T extends Partial<AppConfig> & LegacySchedulingConfig>(
  config: T
): Partial<AppConfig> {
  const migrated: Partial<AppConfig> & LegacySchedulingConfig = { ...config };

  if (migrated.ollamaMaxConcurrency === undefined) {
    migrated.ollamaMaxConcurrency = migrated.classificationConcurrency;
  }
  if (migrated.classifyPaused === undefined) {
    migrated.classifyPaused = migrated.classificationPaused;
  }
  if (migrated.renamePaused === undefined) {
    migrated.renamePaused = migrated.classificationPaused;
  }

  delete migrated.classificationConcurrency;
  delete migrated.classificationPaused;
  return migrated;
}

/**
 * Clamp and sanitize values loaded from disk or updated by the UI.
 */
export function normalizeAppConfig(config: AppConfig): AppConfig {
  const maxVideoSize = Number.isFinite(config.maxVideoSize)
    ? Math.min(
        MAX_VIDEO_SIZE_LIMIT,
        Math.max(MIN_VIDEO_SIZE_LIMIT, Math.floor(config.maxVideoSize))
      )
    : DEFAULT_MAX_VIDEO_SIZE;

  const allowedTypes = new Set(SUPPORTED_VIDEO_MIME_TYPES);
  const requestedTypes = Array.isArray(config.enabledVideoTypes)
    ? config.enabledVideoTypes.filter((type) => allowedTypes.has(type))
    : [];
  const enabledVideoTypes = [...new Set(requestedTypes)];

  const mediaArchiveIntervalMinutes = Number.isFinite(config.mediaArchiveIntervalMinutes)
    ? Math.min(
        MAX_MEDIA_ARCHIVE_INTERVAL_MINUTES,
        Math.max(MIN_MEDIA_ARCHIVE_INTERVAL_MINUTES, Math.floor(config.mediaArchiveIntervalMinutes))
      )
    : DEFAULT_MEDIA_ARCHIVE_INTERVAL_MINUTES;

  return {
    ...config,
    ollamaMaxConcurrency: normalizeConcurrency(config.ollamaMaxConcurrency),
    classifyConcurrency: normalizeConcurrency(config.classifyConcurrency),
    renameConcurrency: normalizeConcurrency(config.renameConcurrency),
    classifyPaused: config.classifyPaused !== false,
    renamePaused: config.renamePaused !== false,
    captureVideos: config.captureVideos !== false,
    maxVideoSize,
    enabledVideoTypes:
      enabledVideoTypes.length > 0 ? enabledVideoTypes : [...DEFAULT_ENABLED_VIDEO_TYPES],
    videoCaptureMode: normalizeVideoCaptureMode(config.videoCaptureMode),
    videoCaptureModeByHost: normalizeVideoCaptureModeByHost(config.videoCaptureModeByHost),
    videoAssemblyFillGaps:
      typeof config.videoAssemblyFillGaps === 'boolean' ? config.videoAssemblyFillGaps : true,
    mediaArchiveEnabled: config.mediaArchiveEnabled === true,
    mediaArchiveTargetPath:
      typeof config.mediaArchiveTargetPath === 'string' ? config.mediaArchiveTargetPath.trim() : '',
    mediaArchiveIntervalMinutes,
    mediaArchiveConcurrency: normalizeConcurrency(config.mediaArchiveConcurrency),
  };
}
