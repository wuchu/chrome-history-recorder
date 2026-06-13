/**
 * Extension Background - Config Manager
 *
 * Manages user configuration stored in chrome.storage.local.
 */

import { getOllamaClient, FilenameStyle } from './classify/ollama-client';
import { getExistingClassifyScheduler } from './classify/scheduler';
import { getFileManager } from './file-manager';
import { syncOllamaDnrRule } from './ollama-dnr';
import type { ExtensionConfig, TagDefinition } from '../shared/extension-runtime';

/**
 * Default user-defined tags
 */
const DEFAULT_USER_TAGS: TagDefinition[] = [
  { id: 'user:cat', name: 'cat', label: '🐱 猫咪', isSystem: false, sortOrder: 1 },
  { id: 'user:game', name: 'game', label: '🎮 游戏', isSystem: false, sortOrder: 2 },
  { id: 'user:screenshot', name: 'screenshot', label: '📸 截图', isSystem: false, sortOrder: 3 },
  { id: 'user:memo', name: 'memo', label: '📝 笔记', isSystem: false, sortOrder: 4 },
];

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ExtensionConfig = {
  ollamaEndpoint: 'http://localhost:11434',
  // visionModel 不设置默认值，从服务端接口选择返回的第一个
  language: 'zh-CN',
  filenameStyle: 'auto',
  classificationConcurrency: 1,
  classificationPaused: true,
  maxFileSize: 50 * 1024 * 1024, // 50MB
  userDefinedTags: DEFAULT_USER_TAGS,
};

/**
 * Config Manager class
 */
export class ConfigManager {
  private config: ExtensionConfig;
  private onConfigChangeCallback?: (config: ExtensionConfig) => void;

  constructor() {
    this.config = DEFAULT_CONFIG;
  }

  /**
   * Initialize config from storage
   */
  async initialize(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get('vfsConfig');
      if (stored.vfsConfig) {
        this.config = {
          ...DEFAULT_CONFIG,
          ...stored.vfsConfig,
        };
      }
    } catch {
      // Storage not available, use defaults
    }

    // Apply config to components
    this.applyConfig();
    await syncOllamaDnrRule(this.config.ollamaEndpoint);
  }

  /**
   * Get current config
   */
  getConfig(): ExtensionConfig {
    return this.config;
  }

  /**
   * Update config
   */
  async updateConfig(updates: Partial<ExtensionConfig>): Promise<void> {
    this.config = {
      ...this.config,
      ...updates,
    };

    // Save to storage
    try {
      await chrome.storage.local.set({ vfsConfig: this.config });
    } catch {
      // Storage not available
    }

    // Apply config to components
    this.applyConfig();
    await syncOllamaDnrRule(this.config.ollamaEndpoint);

    // Broadcast config change
    this.onConfigChangeCallback?.(this.config);
    getFileManager().broadcastEvent('config:updated', this.config as unknown as Record<string, unknown>);
  }

  /**
   * Apply config to components
   */
  private applyConfig(): void {
    // Update Ollama client
    const ollamaClient = getOllamaClient();
    ollamaClient.updateConfig({
      endpoint: this.config.ollamaEndpoint,
      model: this.config.visionModel,
      language: this.config.language,
      filenameStyle: this.config.filenameStyle,
      filenameStylePrompt: this.config.filenameStylePrompt,
      userDefinedTags: this.config.userDefinedTags,
    });

    // Update scheduler if it has already been initialized.
    const scheduler = getExistingClassifyScheduler();
    scheduler?.updateConcurrency(this.config.classificationConcurrency);
  }

  /**
   * Set config change callback
   */
  onConfigChange(callback: (config: ExtensionConfig) => void): void {
    this.onConfigChangeCallback = callback;
  }

  /**
   * Sync config to DevTools Panel
   */
  async syncToPanel(): Promise<void> {
    try {
      await chrome.runtime.sendMessage({
        type: 'config:sync',
        data: this.config,
      });
    } catch {
      // No listeners
    }
  }

  /**
   * Reset to defaults
   */
  async reset(): Promise<void> {
    await this.updateConfig(DEFAULT_CONFIG);
  }
}

// Singleton instance
let configManager: ConfigManager | null = null;

/**
 * Get Config Manager singleton
 */
export function getConfigManager(): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager();
  }
  return configManager;
}

/**
 * Initialize Config Manager
 */
export async function initConfigManager(): Promise<ConfigManager> {
  configManager = new ConfigManager();
  await configManager.initialize();
  return configManager;
}
