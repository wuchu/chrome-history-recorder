/**
 * App Configuration Store
 *
 * Persists the app's runtime configuration in the workspace. The app is the
 * source of truth; the extension keeps a mirror.
 */

import fs from 'fs';
import path from 'path';
import { DEFAULT_APP_CONFIG, normalizeAppConfig, type AppConfig } from './types';

export class ConfigStore {
  private readonly configPath: string;
  private readonly authoritativeMarkerPath: string;
  private authoritative = false;
  private config: AppConfig = { ...DEFAULT_APP_CONFIG };
  private listeners = new Set<(config: AppConfig) => void>();

  constructor(workspacePath: string) {
    this.configPath = path.join(workspacePath, 'config.json');
    this.authoritativeMarkerPath = path.join(workspacePath, '.config-authoritative');
  }

  /**
   * Load persisted configuration, or keep defaults when none exists.
   */
  load(): AppConfig {
    this.authoritative = fs.existsSync(this.authoritativeMarkerPath);
    try {
      if (fs.existsSync(this.configPath)) {
        const parsed = JSON.parse(fs.readFileSync(this.configPath, 'utf-8')) as Partial<AppConfig>;
        this.config = normalizeAppConfig({ ...DEFAULT_APP_CONFIG, ...parsed });
      }
    } catch (error) {
      console.warn('[ConfigStore] Failed to load config, using defaults:', error);
      this.config = { ...DEFAULT_APP_CONFIG };
    }
    return this.get();
  }

  get(): AppConfig {
    return {
      ...this.config,
      promptTemplates: this.config.promptTemplates ? { ...this.config.promptTemplates } : undefined,
      enabledVideoTypes: [...this.config.enabledVideoTypes],
    };
  }

  hasPersistedConfig(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * Whether the stored configuration is authoritative (user-saved or migrated).
   */
  isAuthoritative(): boolean {
    return this.authoritative;
  }

  /**
   * Merge updates, persist, and notify listeners. Marks the configuration as
   * authoritative, so a later legacy migration will not overwrite user values.
   */
  update(updates: Partial<AppConfig>): AppConfig {
    this.config = normalizeAppConfig({ ...this.config, ...updates });
    this.persist();
    this.markAuthoritative();
    this.notify();
    return this.get();
  }

  /**
   * Apply a runtime-derived value (for example a discovered vision model)
   * without marking the configuration authoritative, so legacy config can
   * still be migrated when the extension first connects.
   */
  updateRuntime(updates: Partial<AppConfig>): AppConfig {
    this.config = normalizeAppConfig({ ...this.config, ...updates });
    this.persist();
    this.notify();
    return this.get();
  }

  /**
   * One-time import of legacy extension configuration. Returns false when the
   * app already has authoritative configuration.
   */
  importLegacy(legacy: Partial<AppConfig>): boolean {
    if (this.authoritative) {
      return false;
    }

    this.config = normalizeAppConfig({ ...this.config, ...legacy });
    this.persist();
    this.markAuthoritative();
    this.notify();
    return true;
  }

  onChange(listener: (config: AppConfig) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private markAuthoritative(): void {
    this.authoritative = true;
    try {
      fs.writeFileSync(this.authoritativeMarkerPath, new Date().toISOString(), {
        mode: 0o644,
      });
    } catch (error) {
      console.error('[ConfigStore] Failed to write authoritative marker:', error);
    }
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), {
        mode: 0o644,
      });
    } catch (error) {
      console.error('[ConfigStore] Failed to persist config:', error);
    }
  }

  private notify(): void {
    const snapshot = this.get();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn('[ConfigStore] Listener failed:', error);
      }
    }
  }
}
