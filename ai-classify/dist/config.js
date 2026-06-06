/**
 * AI Classify - Configuration Management
 */
import fs from 'fs-extra';
import path from 'path';
import { DEFAULT_CONFIG } from './types.js';
const CONFIG_FILE = '.ai-classify.json';
export async function loadConfig(projectDir) {
    const configPath = path.join(projectDir, CONFIG_FILE);
    if (await fs.pathExists(configPath)) {
        const loaded = await fs.readJson(configPath);
        return { ...DEFAULT_CONFIG, ...loaded };
    }
    return DEFAULT_CONFIG;
}
export async function saveConfig(projectDir, config) {
    const configPath = path.join(projectDir, CONFIG_FILE);
    await fs.writeJson(configPath, config, { spaces: 2 });
}
export function mergeWithCliArgs(config, args) {
    return {
        ...config,
        ...args,
        // Only override if explicitly provided
        input: args.input || config.input,
        output: args.output || config.output,
        ollamaEndpoint: args.ollamaEndpoint || config.ollamaEndpoint
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
    return errors;
}
//# sourceMappingURL=config.js.map