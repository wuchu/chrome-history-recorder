/**
 * VFS Service - Configuration Module
 *
 * Handles workspace configuration and CLI arguments.
 */
/**
 * Where the resolved workspace path came from.
 */
export type WorkspaceSource = 'cli' | 'env' | 'default';
/**
 * VFS Service configuration
 */
export interface VFSConfig {
    workspacePath: string;
    source: WorkspaceSource;
}
/**
 * Parse command line arguments and environment variables.
 *
 * Precedence: `--workspace` / `-w` > `VFS_WORKSPACE` > default path.
 */
export declare function parseArgs(args: string[], env?: NodeJS.ProcessEnv): VFSConfig;
/**
 * Get default workspace path
 */
export declare function getDefaultWorkspacePath(): string;
/**
 * Expand ~ to home directory
 */
export declare function expandPath(filePath: string): string;
//# sourceMappingURL=config.d.ts.map