/**
 * AI Classify - Configuration Management (YAML Format)
 */
import { Config } from './types.js';
/**
 * Resolve the config file path and return the absolute path
 */
export declare function resolveConfigPath(projectDir: string): string;
/**
 * Check if config file exists in the given directory
 */
export declare function checkConfigExists(projectDir: string): Promise<boolean>;
/**
 * Load configuration from YAML file
 */
export declare function loadConfig(projectDir: string): Promise<Config>;
/**
 * Save configuration to YAML file
 */
export declare function saveConfig(projectDir: string, config: Config): Promise<void>;
/**
 * Get a config value by key (supports nested keys like 'patterns[0]')
 */
export declare function getConfigValue(projectDir: string, key: string): Promise<unknown>;
/**
 * Set a config value by key (supports nested keys like 'patterns[0]')
 */
export declare function setConfigValue(projectDir: string, key: string, value: unknown): Promise<void>;
/**
 * List all config values
 */
export declare function listConfig(projectDir: string): Promise<Config>;
export declare function mergeWithCliArgs(config: Config, args: Partial<Config>): Config;
export declare function validateConfig(config: Config): string[];
/**
 * Display friendly error messages for missing configuration
 */
export declare function formatConfigErrors(errors: string[]): string;
//# sourceMappingURL=config.d.ts.map