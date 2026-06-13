/**
 * VFS Service - Configuration Module
 *
 * Handles workspace configuration and CLI arguments.
 */
/**
 * VFS Service configuration
 */
export interface VFSConfig {
    workspacePath: string;
}
/**
 * Parse command line arguments
 */
export declare function parseArgs(args: string[]): VFSConfig;
/**
 * Get default workspace path
 */
export declare function getDefaultWorkspacePath(): string;
/**
 * Expand ~ to home directory
 */
export declare function expandPath(filePath: string): string;
//# sourceMappingURL=config.d.ts.map