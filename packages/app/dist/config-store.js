"use strict";
/**
 * App Configuration Store
 *
 * Persists the app's runtime configuration in the workspace. The app is the
 * source of truth; the extension keeps a mirror.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const types_1 = require("./types");
class ConfigStore {
    configPath;
    authoritativeMarkerPath;
    authoritative = false;
    config = { ...types_1.DEFAULT_APP_CONFIG };
    listeners = new Set();
    constructor(workspacePath) {
        this.configPath = path_1.default.join(workspacePath, 'config.json');
        this.authoritativeMarkerPath = path_1.default.join(workspacePath, '.config-authoritative');
    }
    /**
     * Load persisted configuration, or keep defaults when none exists.
     */
    load() {
        this.authoritative = fs_1.default.existsSync(this.authoritativeMarkerPath);
        try {
            if (fs_1.default.existsSync(this.configPath)) {
                const parsed = JSON.parse(fs_1.default.readFileSync(this.configPath, 'utf-8'));
                this.config = (0, types_1.normalizeAppConfig)({ ...types_1.DEFAULT_APP_CONFIG, ...parsed });
            }
        }
        catch (error) {
            console.warn('[ConfigStore] Failed to load config, using defaults:', error);
            this.config = { ...types_1.DEFAULT_APP_CONFIG };
        }
        return this.get();
    }
    get() {
        return {
            ...this.config,
            promptTemplates: this.config.promptTemplates ? { ...this.config.promptTemplates } : undefined,
            enabledVideoTypes: [...this.config.enabledVideoTypes],
        };
    }
    hasPersistedConfig() {
        return fs_1.default.existsSync(this.configPath);
    }
    /**
     * Whether the stored configuration is authoritative (user-saved or migrated).
     */
    isAuthoritative() {
        return this.authoritative;
    }
    /**
     * Merge updates, persist, and notify listeners. Marks the configuration as
     * authoritative, so a later legacy migration will not overwrite user values.
     */
    update(updates) {
        this.config = (0, types_1.normalizeAppConfig)({ ...this.config, ...updates });
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
    updateRuntime(updates) {
        this.config = (0, types_1.normalizeAppConfig)({ ...this.config, ...updates });
        this.persist();
        this.notify();
        return this.get();
    }
    /**
     * One-time import of legacy extension configuration. Returns false when the
     * app already has authoritative configuration.
     */
    importLegacy(legacy) {
        if (this.authoritative) {
            return false;
        }
        this.config = (0, types_1.normalizeAppConfig)({ ...this.config, ...legacy });
        this.persist();
        this.markAuthoritative();
        this.notify();
        return true;
    }
    onChange(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    markAuthoritative() {
        this.authoritative = true;
        try {
            fs_1.default.writeFileSync(this.authoritativeMarkerPath, new Date().toISOString(), {
                mode: 0o644,
            });
        }
        catch (error) {
            console.error('[ConfigStore] Failed to write authoritative marker:', error);
        }
    }
    persist() {
        try {
            fs_1.default.mkdirSync(path_1.default.dirname(this.configPath), { recursive: true });
            fs_1.default.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), {
                mode: 0o644,
            });
        }
        catch (error) {
            console.error('[ConfigStore] Failed to persist config:', error);
        }
    }
    notify() {
        const snapshot = this.get();
        for (const listener of this.listeners) {
            try {
                listener(snapshot);
            }
            catch (error) {
                console.warn('[ConfigStore] Listener failed:', error);
            }
        }
    }
}
exports.ConfigStore = ConfigStore;
//# sourceMappingURL=config-store.js.map