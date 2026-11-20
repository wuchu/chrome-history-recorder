/**
 * App configuration types and defaults.
 */
import type { PromptTemplates } from 'ai';
export declare const MIN_VIDEO_SIZE_LIMIT: number;
export declare const MAX_VIDEO_SIZE_LIMIT: number;
export declare const DEFAULT_MAX_VIDEO_SIZE: number;
export declare const DEFAULT_ENABLED_VIDEO_TYPES: string[];
export declare const SUPPORTED_VIDEO_MIME_TYPES: string[];
export declare const MIN_MEDIA_ARCHIVE_INTERVAL_MINUTES = 1;
export declare const MAX_MEDIA_ARCHIVE_INTERVAL_MINUTES = 1440;
export declare const DEFAULT_MEDIA_ARCHIVE_INTERVAL_MINUTES = 5;
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
export declare const DEFAULT_APP_CONFIG: AppConfig;
/**
 * Clamp and sanitize values loaded from disk or updated by the UI.
 */
export declare function normalizeAppConfig(config: AppConfig): AppConfig;
//# sourceMappingURL=types.d.ts.map