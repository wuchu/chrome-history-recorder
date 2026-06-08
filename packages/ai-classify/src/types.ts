/**
 * AI Classify - Type Definitions
 */

/**
 * Filename naming style options
 */
export type FilenameStyle =
  | 'auto'
  | 'fun'
  | 'sexy'
  | 'artistic'
  | 'poetic'
  | 'minimal'
  | 'professional'
  | 'narrative';

export interface Config {
  input: string;
  output: string;
  ollamaEndpoint: string;
  visionModel: string;
  patterns: string[];
  ignorePatterns: string[];
  organizeBy: 'category' | 'date';
  maxFileSize: number;
  concurrency: number;
  language?: string;
  filenameStyle?: FilenameStyle; // Preset filename naming style
  filenameStylePrompt?: string; // Custom filename style prompt (higher priority)
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

export const DEFAULT_CONFIG: Config = {
  input: './input',
  output: './output',
  ollamaEndpoint: 'http://localhost:11434',
  visionModel: 'llava',
  patterns: ['**/*.{jpg,jpeg,png,gif,webp,bmp,mp4}'],
  ignorePatterns: ['**/node_modules/**', '**/.git/**'],
  organizeBy: 'category',
  maxFileSize: 50 * 1024 * 1024, // 50MB
  concurrency: 3,
};
