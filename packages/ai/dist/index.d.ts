/**
 * AI Package
 *
 * Ollama-backed vision classification, renaming, and translation for the
 * media app. Media access is injected via `MediaReader` so this package has
 * no transport or storage dependency at runtime.
 */
export { OllamaClient, DEFAULT_PREFERRED_MODEL, selectPreferredOllamaModel, type MediaReader, type OllamaClientConfig, type OllamaModel, type RenameResult, type TagClassificationResult, } from './ollama-client';
export { DEFAULT_PROMPT_TEMPLATES, renderTemplate, resolveTemplate, type PromptTemplates, } from './prompt-templates';
export { encodeBase64Async, bytesToBase64Chunked } from './base64';
//# sourceMappingURL=index.d.ts.map