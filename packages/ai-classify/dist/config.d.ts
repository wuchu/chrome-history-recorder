/**
 * AI Classify - Configuration Management
 */
import { Config } from './types.js';
/**
 * Resolve the config file path and return the absolute path
 */
export declare function resolveConfigPath(projectDir: string, configFile?: string): string;
export declare function loadConfig(projectDir: string, configFile?: string): Promise<Config>;
export declare function saveConfig(projectDir: string, config: Config): Promise<void>;
export declare function mergeWithCliArgs(config: Config, args: Partial<Config>): Config;
export declare function validateConfig(config: Config): string[];
/**
 * Display friendly error messages for missing configuration
 */
export declare function formatConfigErrors(errors: string[]): string;
//# sourceMappingURL=config.d.ts.map