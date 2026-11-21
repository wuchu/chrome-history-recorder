/**
 * App Configuration Store
 *
 * Persists the app's runtime configuration in the workspace. The app is the
 * source of truth; the extension keeps a mirror.
 */
import { type AppConfig, type LegacySchedulingConfig } from './types';
export declare class ConfigStore {
    private readonly configPath;
    private readonly authoritativeMarkerPath;
    private authoritative;
    private config;
    private listeners;
    constructor(workspacePath: string);
    /**
     * Load persisted configuration, or keep defaults when none exists.
     */
    load(): AppConfig;
    get(): AppConfig;
    hasPersistedConfig(): boolean;
    /**
     * Whether the stored configuration is authoritative (user-saved or migrated).
     */
    isAuthoritative(): boolean;
    /**
     * Merge updates, persist, and notify listeners. Marks the configuration as
     * authoritative, so a later legacy migration will not overwrite user values.
     */
    update(updates: Partial<AppConfig>): AppConfig;
    /**
     * Apply a runtime-derived value (for example a discovered vision model)
     * without marking the configuration authoritative, so legacy config can
     * still be migrated when the extension first connects.
     */
    updateRuntime(updates: Partial<AppConfig>): AppConfig;
    /**
     * One-time import of legacy extension configuration. Returns false when the
     * app already has authoritative configuration.
     */
    importLegacy(legacy: Partial<AppConfig> & LegacySchedulingConfig): boolean;
    onChange(listener: (config: AppConfig) => void): () => void;
    private markAuthoritative;
    private persist;
    private notify;
}
//# sourceMappingURL=config-store.d.ts.map