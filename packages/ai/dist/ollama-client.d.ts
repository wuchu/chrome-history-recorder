/**
 * Ollama Client
 *
 * HTTP client for the local Ollama API. Runs in the app process and reads
 * media through an injected `MediaReader` backed by the in-process VFSAPI.
 */
import { type PromptTemplates } from './prompt-templates';
/**
 * Media access needed by the classifier. Implemented by the app with VFSAPI.
 */
export interface MediaReader {
    getThumbnail(hash: string, size: 'small' | 'medium' | 'large'): Promise<{
        buffer: Buffer | Uint8Array | number[];
        mimeType: string;
    } | null>;
    getFile(hash: string): {
        buffer: Buffer | Uint8Array | number[];
        mimeType: string;
    } | null;
    getTagVocabulary(limit: number): string[];
}
/**
 * Tag-focused classification result produced by a single vision call.
 */
export interface TagClassificationResult {
    tags: string[];
    aliases: Record<string, string>;
    confidence: number;
    model: string;
}
/**
 * Rename result produced by a single vision call.
 */
export interface RenameResult {
    suggestedName: string;
    model: string;
}
/**
 * Ollama model returned by /api/tags
 */
export interface OllamaModel {
    name: string;
    modifiedAt?: string;
    size?: number;
    family?: string;
    parameterSize?: string;
    quantizationLevel?: string;
}
/**
 * Ollama Client configuration
 */
export interface OllamaClientConfig {
    endpoint?: string;
    model?: string | undefined;
    language?: string;
    promptTemplates?: PromptTemplates;
    timeout?: number;
    media: MediaReader;
}
/**
 * Default preferred vision model when no model is configured.
 */
export declare const DEFAULT_PREFERRED_MODEL = "gemma4:e4b";
export declare function selectPreferredOllamaModel(models: OllamaModel[], currentModel?: string): string | null;
/**
 * Ollama Client class
 */
export declare class OllamaClient {
    private config;
    private media;
    private available;
    private onStatusCallback?;
    private healthCheckInterval?;
    private lastHealthStatus?;
    constructor(config: OllamaClientConfig);
    /**
     * Check Ollama health
     */
    checkHealth(): Promise<boolean>;
    /**
     * Start periodic health check
     */
    startPeriodicHealthCheck(intervalMs?: number): void;
    /**
     * Stop periodic health check
     */
    stopPeriodicHealthCheck(): void;
    /**
     * Check if available
     */
    isAvailable(): boolean;
    /**
     * List installed Ollama models
     */
    listModels(): Promise<OllamaModel[]>;
    /**
     * Select and apply the best installed model if the current one is unavailable.
     */
    selectAvailableModel(): Promise<{
        models: OllamaModel[];
        selectedModel: string | null;
        changed: boolean;
    }>;
    /**
     * Set status callback
     */
    onStatus(callback: (available: boolean) => void): void;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<Omit<OllamaClientConfig, 'media'>>): void;
    /**
     * Get configuration
     */
    getConfig(): OllamaClientConfig;
    /**
     * Obtain a representative image for a media hash (large thumbnail when
     * available, otherwise the original blob), read in-process.
     */
    getRepresentativeImage(hash: string): Promise<{
        buffer: ArrayBuffer;
        mimeType: string;
    }>;
    /**
     * Send a single vision request to Ollama and return the text content.
     */
    private callVision;
    /**
     * Classification task: one vision call that generates tags and canonicalizes
     * them against the top-N vocabulary.
     */
    classifyTagsByHash(hash: string): Promise<TagClassificationResult>;
    /**
     * Rename task: one vision call that produces a display filename only.
     */
    renameByHash(hash: string): Promise<RenameResult>;
    /**
     * Translate tag names to Chinese
     */
    translateTags(text: string): Promise<string>;
}
//# sourceMappingURL=ollama-client.d.ts.map