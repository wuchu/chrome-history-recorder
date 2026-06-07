/**
 * AI Classify - Configuration Management
 */
import fs from 'fs-extra';
import path from 'path';
import { DEFAULT_CONFIG } from './types.js';
const CONFIG_FILE = '.ai-classify.json';
/**
 * Resolve the config file path and return the absolute path
 */
export function resolveConfigPath(projectDir, configFile) {
    return configFile
        ? path.resolve(configFile) // Absolute or relative path
        : path.join(projectDir, CONFIG_FILE); // Default path
}
export async function loadConfig(projectDir, configFile) {
    // Resolve config file path
    const configPath = resolveConfigPath(projectDir, configFile);
    if (await fs.pathExists(configPath)) {
        const loaded = await fs.readJson(configPath);
        return { ...DEFAULT_CONFIG, ...loaded };
    }
    // Return default config if no file exists
    return DEFAULT_CONFIG;
}
export async function saveConfig(projectDir, config) {
    const configPath = path.join(projectDir, CONFIG_FILE);
    await fs.writeJson(configPath, config, { spaces: 2 });
}
export function mergeWithCliArgs(config, args) {
    return {
        ...config,
        // Only override if explicitly provided (not undefined)
        input: args.input !== undefined ? args.input : config.input,
        output: args.output !== undefined ? args.output : config.output,
        ollamaEndpoint: args.ollamaEndpoint !== undefined ? args.ollamaEndpoint : config.ollamaEndpoint,
        visionModel: args.visionModel !== undefined ? args.visionModel : config.visionModel,
        textModel: args.textModel !== undefined ? args.textModel : config.textModel,
        customPrompt: args.customPrompt !== undefined ? args.customPrompt : config.customPrompt,
        concurrency: args.concurrency !== undefined ? args.concurrency : config.concurrency
    };
}
export function validateConfig(config) {
    const errors = [];
    if (!config.input) {
        errors.push('Input directory is required');
    }
    if (!config.output) {
        errors.push('Output directory is required');
    }
    if (!config.ollamaEndpoint) {
        errors.push('Ollama endpoint is required');
    }
    // Validate concurrency range (recommended 1-20)
    if (config.concurrency < 1) {
        errors.push('Concurrency must be at least 1');
    }
    if (config.concurrency > 20) {
        errors.push('Concurrency should not exceed 20 (high values may cause resource issues)');
    }
    return errors;
}
/**
 * Display friendly error messages for missing configuration
 */
export function formatConfigErrors(errors) {
    if (errors.length === 0)
        return '';
    return `Configuration errors:\n  - ${errors.join('\n  - ')}\n\nPlease provide required options via CLI or config file.\nExample: ai-classify start -i ./input -o ./output --ollama-endpoint http://localhost:11434`;
}
//# sourceMappingURL=config.js.map