/**
 * AI Classify - Configuration Management
 */
import { Config } from './types.js';
export declare function loadConfig(projectDir: string): Promise<Config>;
export declare function saveConfig(projectDir: string, config: Config): Promise<void>;
export declare function mergeWithCliArgs(config: Config, args: Partial<Config>): Config;
export declare function validateConfig(config: Config): string[];
//# sourceMappingURL=config.d.ts.map