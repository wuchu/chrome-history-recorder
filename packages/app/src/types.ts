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

export interface AppConfig {
  ollamaEndpoint: string;
  visionModel?: string;
  language: string;
  promptTemplates?: PromptTemplates;
  classificationConcurrency: number;
  classificationPaused: boolean;
  maxFileSize: number;
  captureVideos: boolean;
  maxVideoSize: number;
  enabledVideoTypes: string[];
  mediaArchiveEnabled: boolean;
  mediaArchiveTargetPath: string;
  mediaArchiveIntervalMinutes: number;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  ollamaEndpoint: 'http://localhost:11434',
  language: 'zh-CN',
  classificationConcurrency: 1,
  classificationPaused: true,
  maxFileSize: 50 * 1024 * 1024,
  captureVideos: true,
  maxVideoSize: DEFAULT_MAX_VIDEO_SIZE,
  enabledVideoTypes: [...DEFAULT_ENABLED_VIDEO_TYPES],
  mediaArchiveEnabled: false,
  mediaArchiveTargetPath: '',
  mediaArchiveIntervalMinutes: DEFAULT_MEDIA_ARCHIVE_INTERVAL_MINUTES,
};

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
    classificationConcurrency: Math.max(1, Math.floor(config.classificationConcurrency || 1)),
    captureVideos: config.captureVideos !== false,
    maxVideoSize,
    enabledVideoTypes:
      enabledVideoTypes.length > 0 ? enabledVideoTypes : [...DEFAULT_ENABLED_VIDEO_TYPES],
    mediaArchiveEnabled: config.mediaArchiveEnabled === true,
    mediaArchiveTargetPath:
      typeof config.mediaArchiveTargetPath === 'string' ? config.mediaArchiveTargetPath.trim() : '',
    mediaArchiveIntervalMinutes,
  };
}
