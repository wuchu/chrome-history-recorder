/**
 * VFS Service - Configuration Module
 *
 * Handles workspace configuration and CLI arguments.
 */

import path from 'path';
import os from 'os';

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
export function parseArgs(args: string[], env: NodeJS.ProcessEnv = process.env): VFSConfig {
  let workspacePath = getDefaultWorkspacePath();
  let source: WorkspaceSource = 'default';

  const envWorkspace = env.VFS_WORKSPACE?.trim();
  if (envWorkspace) {
    workspacePath = expandPath(envWorkspace);
    source = 'env';
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--workspace' || arg === '-w') {
      const value = args[i + 1];
      if (value) {
        workspacePath = expandPath(value);
        source = 'cli';
        i++; // Skip next argument (the value)
      }
    }
  }

  return {
    workspacePath,
    source,
  };
}

/**
 * Get default workspace path
 */
export function getDefaultWorkspacePath(): string {
  return path.join(os.homedir(), '.vfs-workspace');
}

/**
 * Expand ~ to home directory
 */
export function expandPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}
