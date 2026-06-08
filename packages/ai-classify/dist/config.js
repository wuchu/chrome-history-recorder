/**
 * AI Classify - Configuration Management (YAML Format)
 */
import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { DEFAULT_CONFIG } from './types.js';
const CONFIG_FILE = '.ai-classify.yaml';
/**
 * Resolve the config file path and return the absolute path
 */
export function resolveConfigPath(projectDir) {
    return path.join(projectDir, CONFIG_FILE);
}
/**
 * Check if config file exists in the given directory
 */
export async function checkConfigExists(projectDir) {
    const configPath = resolveConfigPath(projectDir);
    return fs.pathExists(configPath);
}
/**
 * Load configuration from YAML file
 */
export async function loadConfig(projectDir) {
    const configPath = resolveConfigPath(projectDir);
    if (await fs.pathExists(configPath)) {
        try {
            const content = await fs.readFile(configPath, 'utf-8');
            const loaded = yaml.load(content);
            return { ...DEFAULT_CONFIG, ...loaded };
        }
        catch (error) {
            const yamlError = error;
            if (yamlError.mark) {
                throw new Error(`Config file syntax error at line ${yamlError.mark.line}: ${yamlError.message}`);
            }
            throw new Error(`Failed to load config: ${error}`);
        }
    }
    // Return default config if no file exists
    return DEFAULT_CONFIG;
}
/**
 * Save configuration to YAML file
 */
export async function saveConfig(projectDir, config) {
    const configPath = resolveConfigPath(projectDir);
    const content = yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
        forceQuotes: false,
    });
    await fs.writeFile(configPath, content, 'utf-8');
}
/**
 * Get a config value by key (supports nested keys like 'patterns[0]')
 */
export async function getConfigValue(projectDir, key) {
    const config = await loadConfig(projectDir);
    // Support nested keys and array indices
    const parts = key.split(/\.|\[|\]/).filter((p) => p !== '');
    let value = config;
    for (const part of parts) {
        if (value === undefined || value === null) {
            return undefined;
        }
        value = value[part];
    }
    return value;
}
/**
 * Set a config value by key (supports nested keys like 'patterns[0]')
 */
export async function setConfigValue(projectDir, key, value) {
    const config = await loadConfig(projectDir);
    // Support nested keys and array indices
    const parts = key.split(/\.|\[|\]/).filter((p) => p !== '');
    let obj = config;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (obj[part] === undefined) {
            obj[part] = {};
        }
        obj = obj[part];
    }
    const lastPart = parts[parts.length - 1];
    obj[lastPart] = value;
    await saveConfig(projectDir, config);
}
/**
 * List all config values
 */
export async function listConfig(projectDir) {
    return await loadConfig(projectDir);
}
export function mergeWithCliArgs(config, args) {
    return {
        ...config,
        // Only override if explicitly provided (not undefined)
        input: args.input !== undefined ? args.input : config.input,
        output: args.output !== undefined ? args.output : config.output,
        ollamaEndpoint: args.ollamaEndpoint !== undefined ? args.ollamaEndpoint : config.ollamaEndpoint,
        visionModel: args.visionModel !== undefined ? args.visionModel : config.visionModel,
        concurrency: args.concurrency !== undefined ? args.concurrency : config.concurrency,
        filenameStyle: args.filenameStyle !== undefined ? args.filenameStyle : config.filenameStyle,
        filenameStylePrompt: args.filenameStylePrompt !== undefined
            ? args.filenameStylePrompt
            : config.filenameStylePrompt,
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
    if (!config.visionModel) {
        errors.push('Vision model is required');
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
    return `Configuration errors:\n  - ${errors.join('\n  - ')}\n\nPlease provide required options via config file.\nRun 'ai-classify init' to create a configuration file interactively.`;
}
//# sourceMappingURL=config.js.map