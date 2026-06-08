/**
 * AI Classify - Type Definitions
 */
export const DEFAULT_CONFIG = {
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
//# sourceMappingURL=types.js.map