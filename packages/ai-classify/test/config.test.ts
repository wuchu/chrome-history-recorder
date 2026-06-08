/**
 * Tests for config.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
  resolveConfigPath,
  checkConfigExists,
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  listConfig,
  mergeWithCliArgs,
  validateConfig,
  formatConfigErrors,
} from '../src/config';
import { DEFAULT_CONFIG, type Config } from '../src/types';

describe('config', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = path.join(os.tmpdir(), `ai-classify-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.remove(tempDir);
  });

  describe('resolveConfigPath', () => {
    it('should return the correct config file path', () => {
      const result = resolveConfigPath('/test/dir');
      expect(result).toBe('/test/dir/.ai-classify.yaml');
    });
  });

  describe('checkConfigExists', () => {
    it('should return false when config file does not exist', async () => {
      const result = await checkConfigExists(tempDir);
      expect(result).toBe(false);
    });

    it('should return true when config file exists', async () => {
      const configPath = resolveConfigPath(tempDir);
      await fs.writeFile(configPath, 'input: ./test', 'utf-8');
      const result = await checkConfigExists(tempDir);
      expect(result).toBe(true);
    });
  });

  describe('loadConfig', () => {
    it('should return default config when no config file exists', async () => {
      const result = await loadConfig(tempDir);
      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('should load and merge config from YAML file', async () => {
      const configPath = resolveConfigPath(tempDir);
      const yamlContent = `
input: ./custom-input
output: ./custom-output
visionModel: custom-model
concurrency: 5
`;
      await fs.writeFile(configPath, yamlContent, 'utf-8');

      const result = await loadConfig(tempDir);
      expect(result.input).toBe('./custom-input');
      expect(result.output).toBe('./custom-output');
      expect(result.visionModel).toBe('custom-model');
      expect(result.concurrency).toBe(5);
      // Default values should be preserved
      expect(result.ollamaEndpoint).toBe(DEFAULT_CONFIG.ollamaEndpoint);
      expect(result.patterns).toEqual(DEFAULT_CONFIG.patterns);
    });

    it('should throw error for invalid YAML syntax', async () => {
      const configPath = resolveConfigPath(tempDir);
      // Use truly invalid YAML that will cause a parse error
      const invalidYaml = `input: [unclosed bracket`;
      await fs.writeFile(configPath, invalidYaml, 'utf-8');

      await expect(loadConfig(tempDir)).rejects.toThrow();
    });
  });

  describe('saveConfig', () => {
    it('should save config to YAML file', async () => {
      const config: Config = {
        ...DEFAULT_CONFIG,
        input: './test-input',
        concurrency: 10,
      };

      await saveConfig(tempDir, config);

      const configPath = resolveConfigPath(tempDir);
      const content = await fs.readFile(configPath, 'utf-8');
      expect(content).toContain('input: ./test-input');
      expect(content).toContain('concurrency: 10');
    });

    it('should create config file if it does not exist', async () => {
      await saveConfig(tempDir, DEFAULT_CONFIG);

      const exists = await checkConfigExists(tempDir);
      expect(exists).toBe(true);
    });
  });

  describe('getConfigValue', () => {
    it('should get a simple config value', async () => {
      await saveConfig(tempDir, { ...DEFAULT_CONFIG, concurrency: 7 });
      const result = await getConfigValue(tempDir, 'concurrency');
      expect(result).toBe(7);
    });

    it('should return undefined for non-existent key', async () => {
      await saveConfig(tempDir, DEFAULT_CONFIG);
      const result = await getConfigValue(tempDir, 'nonexistent');
      expect(result).toBeUndefined();
    });

    it('should get nested config value', async () => {
      const config: Config = {
        ...DEFAULT_CONFIG,
        patterns: ['*.jpg', '*.png'],
      };
      await saveConfig(tempDir, config);
      const result = await getConfigValue(tempDir, 'patterns[0]');
      expect(result).toBe('*.jpg');
    });
  });

  describe('setConfigValue', () => {
    it('should set a simple config value', async () => {
      await saveConfig(tempDir, DEFAULT_CONFIG);
      await setConfigValue(tempDir, 'concurrency', 15);

      const config = await loadConfig(tempDir);
      expect(config.concurrency).toBe(15);
    });

    it('should set nested config value', async () => {
      await saveConfig(tempDir, DEFAULT_CONFIG);
      await setConfigValue(tempDir, 'patterns[0]', '*.gif');

      const config = await loadConfig(tempDir);
      expect(config.patterns[0]).toBe('*.gif');
    });
  });

  describe('listConfig', () => {
    it('should return full config', async () => {
      await saveConfig(tempDir, DEFAULT_CONFIG);
      const result = await listConfig(tempDir);
      expect(result).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('mergeWithCliArgs', () => {
    it('should merge CLI args with config', () => {
      const result = mergeWithCliArgs(DEFAULT_CONFIG, { concurrency: 8 });
      expect(result.concurrency).toBe(8);
      expect(result.input).toBe(DEFAULT_CONFIG.input);
    });

    it('should not override with undefined values', () => {
      const result = mergeWithCliArgs(DEFAULT_CONFIG, { concurrency: undefined });
      expect(result.concurrency).toBe(DEFAULT_CONFIG.concurrency);
    });
  });

  describe('validateConfig', () => {
    it('should return empty array for valid config', () => {
      const errors = validateConfig(DEFAULT_CONFIG);
      expect(errors).toEqual([]);
    });

    it('should return errors for missing required fields', () => {
      const invalidConfig: Partial<Config> = {};
      const errors = validateConfig(invalidConfig as Config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('Input directory is required');
    });

    it('should return error for concurrency below 1', () => {
      const config = { ...DEFAULT_CONFIG, concurrency: 0 };
      const errors = validateConfig(config);
      expect(errors).toContain('Concurrency must be at least 1');
    });

    it('should return warning for concurrency above 20', () => {
      const config = { ...DEFAULT_CONFIG, concurrency: 25 };
      const errors = validateConfig(config);
      expect(errors).toContain(
        'Concurrency should not exceed 20 (high values may cause resource issues)'
      );
    });
  });

  describe('formatConfigErrors', () => {
    it('should return empty string for no errors', () => {
      const result = formatConfigErrors([]);
      expect(result).toBe('');
    });

    it('should format errors with bullet points', () => {
      const errors = ['Error 1', 'Error 2'];
      const result = formatConfigErrors(errors);
      expect(result).toContain('- Error 1');
      expect(result).toContain('- Error 2');
      expect(result).toContain('ai-classify init');
    });
  });
});
