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
export declare const MIN_TASK_CONCURRENCY = 1;
export declare const MAX_TASK_CONCURRENCY = 8;
export declare const DEFAULT_TASK_CONCURRENCY = 1;
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
    mediaArchiveEnabled: boolean;
    mediaArchiveTargetPath: string;
    mediaArchiveIntervalMinutes: number;
    mediaArchiveConcurrency: number;
}
export declare const DEFAULT_APP_CONFIG: AppConfig;
/**
 * Legacy scheduling fields that existed before per-task controls. They are
 * read once during migration and never persisted again.
 */
export interface LegacySchedulingConfig {
    classificationConcurrency?: number;
    classificationPaused?: boolean;
}
export declare function normalizeConcurrency(value: unknown): number;
/**
 * Map legacy global scheduling settings onto the new per-task fields. The
 * caller must run this before merging defaults so a persisted `false` is not
 * shadowed by a default `true`.
 */
export declare function migrateLegacyScheduling<T extends Partial<AppConfig> & LegacySchedulingConfig>(config: T): Partial<AppConfig>;
/**
 * Clamp and sanitize values loaded from disk or updated by the UI.
 */
export declare function normalizeAppConfig(config: AppConfig): AppConfig;
//# sourceMappingURL=types.d.ts.map