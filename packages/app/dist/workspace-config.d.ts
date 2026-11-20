/**
 * Workspace path resolution and launcher configuration.
 *
 * The workspace path must be known before the workspace is opened, so it
 * cannot live in `workspace/config.json`. This module owns the user-level
 * launcher configuration and the validation rules shared by the save RPC and
 * the startup path.
 */
import { type WorkspaceSource } from 'vfs';
export type AppWorkspaceSource = WorkspaceSource | 'config';
export interface LauncherConfig {
    version: number;
    workspacePath: string;
}
export interface WorkspaceResolution {
    workspacePath: string;
    defaultPath: string;
    source: AppWorkspaceSource;
    launcherConfigPath: string;
}
export interface WorkspaceInfo {
    path: string;
    defaultPath: string;
    source: AppWorkspaceSource;
    pendingPath?: string;
}
export type WorkspaceErrorCode = 'invalid-path' | 'forbidden-path' | 'parent-missing' | 'not-writable' | 'not-a-directory' | 'not-a-workspace' | 'volume-missing' | 'override-active';
export declare class WorkspaceConfigError extends Error {
    readonly code: WorkspaceErrorCode;
    constructor(code: WorkspaceErrorCode, messageText: string);
}
export interface WorkspaceOptions {
    env?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
    launcherConfigPath?: string;
}
export interface ValidateWorkspaceOptions extends WorkspaceOptions {
    currentPath?: string;
}
export interface WorkspaceUpdateResult {
    pendingPath: string;
}
/**
 * Resolve the platform-specific launcher configuration path.
 */
export declare function getLauncherConfigPath(options?: WorkspaceOptions): string;
/**
 * Read the launcher configuration. Missing, malformed, or unreadable files
 * are treated as "not configured" so startup is never blocked by this file.
 */
export declare function readLauncherConfig(configPath?: string): LauncherConfig | null;
/**
 * Atomically persist the launcher configuration.
 */
export declare function writeLauncherConfig(workspacePath: string, configPath?: string): void;
/**
 * Resolve the workspace path using CLI, environment, launcher configuration,
 * then the default path.
 */
export declare function resolveWorkspace(argv: string[], options?: WorkspaceOptions): WorkspaceResolution;
/**
 * Validate a candidate workspace path. Returns the normalized absolute path.
 *
 * When `currentPath` is provided, paths equal to or inside the running
 * workspace are rejected. Startup validation omits it because the candidate is
 * the workspace being opened.
 */
export declare function validateWorkspaceTarget(target: string, options?: ValidateWorkspaceOptions): string;
/**
 * Describe the current workspace and any path that will apply after restart.
 */
export declare function getWorkspaceInfo(resolution: WorkspaceResolution, options?: WorkspaceOptions): WorkspaceInfo;
/**
 * Validate and persist a new workspace path. The running workspace is not
 * changed; the caller reports that a restart is required.
 */
export declare function updateWorkspacePath(target: string, resolution: WorkspaceResolution, options?: WorkspaceOptions): WorkspaceUpdateResult;
/**
 * Validate and create the workspace for startup. Throws when the configured
 * workspace is unusable so the caller can fail fast.
 */
export declare function prepareWorkspaceAtStartup(resolution: WorkspaceResolution, options?: WorkspaceOptions): string;
export declare function describeWorkspaceSource(source: AppWorkspaceSource): string;
/**
 * Build the startup failure message with recovery instructions.
 */
export declare function formatWorkspaceStartupError(resolution: WorkspaceResolution, error: unknown): string;
//# sourceMappingURL=workspace-config.d.ts.map