/**
 * AI Classify - Configuration Management
 */

import fs from 'fs-extra';
import path from 'path';
import { Config, DEFAULT_CONFIG } from './types.js';

const CONFIG_FILE = '.ai-classify.json';

export async function loadConfig(projectDir: string): Promise<Config> {
  const configPath = path.join(projectDir, CONFIG_FILE);

  if (await fs.pathExists(configPath)) {
    const loaded = await fs.readJson(configPath);
    return { ...DEFAULT_CONFIG, ...loaded };
  }

  return DEFAULT_CONFIG;
}

export async function saveConfig(projectDir: string, config: Config): Promise<void> {
  const configPath = path.join(projectDir, CONFIG_FILE);
  await fs.writeJson(configPath, config, { spaces: 2 });
}

export function mergeWithCliArgs(config: Config, args: Partial<Config>): Config {
  return {
    ...config,
    ...args,
    // Only override if explicitly provided
    input: args.input || config.input,
    output: args.output || config.output,
    ollamaEndpoint: args.ollamaEndpoint || config.ollamaEndpoint
  };
}

export function validateConfig(config: Config): string[] {
  const errors: string[] = [];

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