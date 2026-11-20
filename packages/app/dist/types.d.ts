/**
 * App configuration types and defaults.
 */
import type { PromptTemplates } from 'ai';
export declare const MIN_VIDEO_SIZE_LIMIT: number;
export declare const MAX_VIDEO_SIZE_LIMIT: number;
export declare const DEFAULT_MAX_VIDEO_SIZE: number;
export declare const DEFAULT_ENABLED_VIDEO_TYPES: string[];
export declare const SUPPORTED_VIDEO_MIME_TYPES: string[];
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
}
export declare const DEFAULT_APP_CONFIG: AppConfig;
/**
 * Clamp and sanitize values loaded from disk or updated by the UI.
 */
export declare function normalizeAppConfig(config: AppConfig): AppConfig;
//# sourceMappingURL=types.d.ts.map