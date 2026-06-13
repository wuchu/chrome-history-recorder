/**
 * VFS Service - Configuration Module
 *
 * Handles workspace configuration and CLI arguments.
 */

import path from 'path';
import os from 'os';

/**
 * VFS Service configuration
 */
export interface VFSConfig {
  workspacePath: string;
}

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): VFSConfig {
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