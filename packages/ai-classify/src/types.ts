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
  customPrompt?: string;  // Custom classification prompt for Ollama
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
  textModel: 'llama3',
  patterns: ['**/*.{jpg,jpeg,png,gif,webp,bmp,pdf,txt,md,mp4}'],
  ignorePatterns: ['**/node_modules/**', '**/.git/**'],
  organizeBy: 'category',
  maxFileSize: 50 * 1024 * 1024, // 50MB
  concurrency: 3
};