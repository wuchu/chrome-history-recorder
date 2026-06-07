/**
 * AI Classify - Type Definitions
 */
export interface Config {
    input: string;
    output: string;
    ollamaEndpoint: string;
    visionModel: string;
    textModel: string;
    patterns: string[];
    ignorePatterns: string[];
    organizeBy: 'category' | 'date';
    maxFileSize: number;
    concurrency: number;
    language?: string;
    imgCategories?: string[];
    txtCategories?: string[];
    customPrompt?: string;
}
export interface Task {
    path: string;
    hash: string;
    addedAt: string;
    priority: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error?: string;
}
export interface Queue {
    pending: Task[];
    processing: Task[];
    failed: Task[];
}
export interface IndexRecord {
    outputPath: string;
    processedAt: string;
    category: string;
    originalPath: string;
}
export interface HashIndex {
    processed: Record<string, IndexRecord>;
}
export interface ClassificationResult {
    category: string;
    suggestedName: string;
    tags: string[];
    confidence: number;
    description?: string;
}
export declare const DEFAULT_CONFIG: Config;
//# sourceMappingURL=types.d.ts.map