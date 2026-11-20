"use strict";
/**
 * VFS Service - Configuration Module
 *
 * Handles workspace configuration and CLI arguments.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseArgs = parseArgs;
exports.getDefaultWorkspacePath = getDefaultWorkspacePath;
exports.expandPath = expandPath;
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
/**
 * Parse command line arguments and environment variables.
 *
 * Precedence: `--workspace` / `-w` > `VFS_WORKSPACE` > default path.
 */
function parseArgs(args, env = process.env) {
    let workspacePath = getDefaultWorkspacePath();
    let source = 'default';
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
function getDefaultWorkspacePath() {
    return path_1.default.join(os_1.default.homedir(), '.vfs-workspace');
}
/**
 * Expand ~ to home directory
 */
function expandPath(filePath) {
    if (filePath.startsWith('~')) {
        return path_1.default.join(os_1.default.homedir(), filePath.slice(1));
    }
    return filePath;
}
//# sourceMappingURL=config.js.map