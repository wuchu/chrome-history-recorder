/**
 * VFS Service - Configuration Module
 *
 * Handles workspace configuration and CLI arguments.
 */
import path from 'path';
import os from 'os';
/**
 * Parse command line arguments
 */
export function parseArgs(args) {
    let workspacePath = getDefaultWorkspacePath();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--workspace' || arg === '-w') {
            const value = args[i + 1];
            if (value) {
                workspacePath = expandPath(value);
                i++; // Skip next argument (the value)
            }
        }
    }
    return {
        workspacePath,
    };
}
/**
 * Get default workspace path
 */
export function getDefaultWorkspacePath() {
    return path.join(os.homedir(), '.vfs-workspace');
}
/**
 * Expand ~ to home directory
 */
export function expandPath(filePath) {
    if (filePath.startsWith('~')) {
        return path.join(os.homedir(), filePath.slice(1));
    }
    return filePath;
}
//# sourceMappingURL=config.js.map