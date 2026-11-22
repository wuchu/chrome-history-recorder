"use strict";
/**
 * App configuration types and defaults.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_APP_CONFIG = exports.DEFAULT_VIDEO_CAPTURE_MODE_BY_HOST = exports.DEFAULT_VIDEO_CAPTURE_MODE = exports.DEFAULT_TASK_CONCURRENCY = exports.MAX_TASK_CONCURRENCY = exports.MIN_TASK_CONCURRENCY = exports.DEFAULT_MEDIA_ARCHIVE_INTERVAL_MINUTES = exports.MAX_MEDIA_ARCHIVE_INTERVAL_MINUTES = exports.MIN_MEDIA_ARCHIVE_INTERVAL_MINUTES = exports.SUPPORTED_VIDEO_MIME_TYPES = exports.DEFAULT_ENABLED_VIDEO_TYPES = exports.DEFAULT_MAX_VIDEO_SIZE = exports.MAX_VIDEO_SIZE_LIMIT = exports.MIN_VIDEO_SIZE_LIMIT = void 0;
exports.normalizeConcurrency = normalizeConcurrency;
exports.normalizeVideoCaptureMode = normalizeVideoCaptureMode;
exports.normalizeVideoCaptureModeByHost = normalizeVideoCaptureModeByHost;
exports.migrateLegacyScheduling = migrateLegacyScheduling;
exports.normalizeAppConfig = normalizeAppConfig;
exports.MIN_VIDEO_SIZE_LIMIT = 1 * 1024 * 1024;
exports.MAX_VIDEO_SIZE_LIMIT = 2 * 1024 * 1024 * 1024;
exports.DEFAULT_MAX_VIDEO_SIZE = 200 * 1024 * 1024;
exports.DEFAULT_ENABLED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
exports.SUPPORTED_VIDEO_MIME_TYPES = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/ogg',
    'video/x-matroska',
];
exports.MIN_MEDIA_ARCHIVE_INTERVAL_MINUTES = 1;
exports.MAX_MEDIA_ARCHIVE_INTERVAL_MINUTES = 1440;
exports.DEFAULT_MEDIA_ARCHIVE_INTERVAL_MINUTES = 5;
exports.MIN_TASK_CONCURRENCY = 1;
exports.MAX_TASK_CONCURRENCY = 8;
exports.DEFAULT_TASK_CONCURRENCY = 1;
exports.DEFAULT_VIDEO_CAPTURE_MODE = 're-download';
exports.DEFAULT_VIDEO_CAPTURE_MODE_BY_HOST = {
    'douyin.com': 'buffer-only',
    'douyinvod.com': 'buffer-only',
    'v.douyin.com': 'buffer-only',
};
const VIDEO_CAPTURE_MODES = new Set(['buffer-only', 're-download']);
const MAX_VIDEO_CAPTURE_HOST_OVERRIDES = 100;
exports.DEFAULT_APP_CONFIG = {
    ollamaEndpoint: 'http://localhost:11434',
    language: 'zh-CN',
    ollamaMaxConcurrency: exports.DEFAULT_TASK_CONCURRENCY,
    classifyConcurrency: exports.DEFAULT_TASK_CONCURRENCY,
    renameConcurrency: exports.DEFAULT_TASK_CONCURRENCY,
    classifyPaused: true,
    renamePaused: true,
    maxFileSize: 50 * 1024 * 1024,
    captureVideos: true,
    maxVideoSize: exports.DEFAULT_MAX_VIDEO_SIZE,
    enabledVideoTypes: [...exports.DEFAULT_ENABLED_VIDEO_TYPES],
    videoCaptureMode: exports.DEFAULT_VIDEO_CAPTURE_MODE,
    videoCaptureModeByHost: { ...exports.DEFAULT_VIDEO_CAPTURE_MODE_BY_HOST },
    videoAssemblyFillGaps: true,
    mediaArchiveEnabled: false,
    mediaArchiveTargetPath: '',
    mediaArchiveIntervalMinutes: exports.DEFAULT_MEDIA_ARCHIVE_INTERVAL_MINUTES,
    mediaArchiveConcurrency: exports.DEFAULT_TASK_CONCURRENCY,
};
function normalizeConcurrency(value) {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(exports.MAX_TASK_CONCURRENCY, Math.max(exports.MIN_TASK_CONCURRENCY, Math.floor(value)))
        : exports.DEFAULT_TASK_CONCURRENCY;
}
function normalizeVideoCaptureMode(value, fallback = exports.DEFAULT_VIDEO_CAPTURE_MODE) {
    return typeof value === 'string' && VIDEO_CAPTURE_MODES.has(value)
        ? value
        : fallback;
}
/**
 * Normalize a host-suffix map. Invalid entries are dropped; a missing or
 * non-object value falls back to the built-in overrides.
 */
function normalizeVideoCaptureModeByHost(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { ...exports.DEFAULT_VIDEO_CAPTURE_MODE_BY_HOST };
    }
    const result = {};
    for (const [rawHost, rawMode] of Object.entries(value)) {
        if (Object.keys(result).length >= MAX_VIDEO_CAPTURE_HOST_OVERRIDES)
            break;
        if (typeof rawHost !== 'string')
            continue;
        const host = rawHost
            .trim()
            .toLowerCase()
            .replace(/^\*?\./, '');
        if (!host || host.length > 253)
            continue;
        if (typeof rawMode !== 'string' || !VIDEO_CAPTURE_MODES.has(rawMode)) {
            continue;
        }
        result[host] = rawMode;
    }
    return result;
}
/**
 * Map legacy global scheduling settings onto the new per-task fields. The
 * caller must run this before merging defaults so a persisted `false` is not
 * shadowed by a default `true`.
 */
function migrateLegacyScheduling(config) {
    const migrated = { ...config };
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
function normalizeAppConfig(config) {
    const maxVideoSize = Number.isFinite(config.maxVideoSize)
        ? Math.min(exports.MAX_VIDEO_SIZE_LIMIT, Math.max(exports.MIN_VIDEO_SIZE_LIMIT, Math.floor(config.maxVideoSize)))
        : exports.DEFAULT_MAX_VIDEO_SIZE;
    const allowedTypes = new Set(exports.SUPPORTED_VIDEO_MIME_TYPES);
    const requestedTypes = Array.isArray(config.enabledVideoTypes)
        ? config.enabledVideoTypes.filter((type) => allowedTypes.has(type))
        : [];
    const enabledVideoTypes = [...new Set(requestedTypes)];
    const mediaArchiveIntervalMinutes = Number.isFinite(config.mediaArchiveIntervalMinutes)
        ? Math.min(exports.MAX_MEDIA_ARCHIVE_INTERVAL_MINUTES, Math.max(exports.MIN_MEDIA_ARCHIVE_INTERVAL_MINUTES, Math.floor(config.mediaArchiveIntervalMinutes)))
        : exports.DEFAULT_MEDIA_ARCHIVE_INTERVAL_MINUTES;
    return {
        ...config,
        ollamaMaxConcurrency: normalizeConcurrency(config.ollamaMaxConcurrency),
        classifyConcurrency: normalizeConcurrency(config.classifyConcurrency),
        renameConcurrency: normalizeConcurrency(config.renameConcurrency),
        classifyPaused: config.classifyPaused !== false,
        renamePaused: config.renamePaused !== false,
        captureVideos: config.captureVideos !== false,
        maxVideoSize,
        enabledVideoTypes: enabledVideoTypes.length > 0 ? enabledVideoTypes : [...exports.DEFAULT_ENABLED_VIDEO_TYPES],
        videoCaptureMode: normalizeVideoCaptureMode(config.videoCaptureMode),
        videoCaptureModeByHost: normalizeVideoCaptureModeByHost(config.videoCaptureModeByHost),
        videoAssemblyFillGaps: typeof config.videoAssemblyFillGaps === 'boolean'
            ? config.videoAssemblyFillGaps
            : true,
        mediaArchiveEnabled: config.mediaArchiveEnabled === true,
        mediaArchiveTargetPath: typeof config.mediaArchiveTargetPath === 'string' ? config.mediaArchiveTargetPath.trim() : '',
        mediaArchiveIntervalMinutes,
        mediaArchiveConcurrency: normalizeConcurrency(config.mediaArchiveConcurrency),
    };
}
//# sourceMappingURL=types.js.map