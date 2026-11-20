"use strict";
/**
 * App configuration types and defaults.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_APP_CONFIG = exports.DEFAULT_MEDIA_ARCHIVE_INTERVAL_MINUTES = exports.MAX_MEDIA_ARCHIVE_INTERVAL_MINUTES = exports.MIN_MEDIA_ARCHIVE_INTERVAL_MINUTES = exports.SUPPORTED_VIDEO_MIME_TYPES = exports.DEFAULT_ENABLED_VIDEO_TYPES = exports.DEFAULT_MAX_VIDEO_SIZE = exports.MAX_VIDEO_SIZE_LIMIT = exports.MIN_VIDEO_SIZE_LIMIT = void 0;
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
exports.DEFAULT_APP_CONFIG = {
    ollamaEndpoint: 'http://localhost:11434',
    language: 'zh-CN',
    classificationConcurrency: 1,
    classificationPaused: true,
    maxFileSize: 50 * 1024 * 1024,
    captureVideos: true,
    maxVideoSize: exports.DEFAULT_MAX_VIDEO_SIZE,
    enabledVideoTypes: [...exports.DEFAULT_ENABLED_VIDEO_TYPES],
    mediaArchiveEnabled: false,
    mediaArchiveTargetPath: '',
    mediaArchiveIntervalMinutes: exports.DEFAULT_MEDIA_ARCHIVE_INTERVAL_MINUTES,
};
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
        classificationConcurrency: Math.max(1, Math.floor(config.classificationConcurrency || 1)),
        captureVideos: config.captureVideos !== false,
        maxVideoSize,
        enabledVideoTypes: enabledVideoTypes.length > 0 ? enabledVideoTypes : [...exports.DEFAULT_ENABLED_VIDEO_TYPES],
        mediaArchiveEnabled: config.mediaArchiveEnabled === true,
        mediaArchiveTargetPath: typeof config.mediaArchiveTargetPath === 'string' ? config.mediaArchiveTargetPath.trim() : '',
        mediaArchiveIntervalMinutes,
    };
}
//# sourceMappingURL=types.js.map