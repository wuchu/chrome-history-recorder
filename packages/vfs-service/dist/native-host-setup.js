/**
 * VFS Service - Native Host Setup Module
 *
 * Handles automatic registration of Native Messaging Host manifest.
 */
import os from 'os';
import path from 'path';
import fs from 'fs';
/**
 * Get Chrome Native Messaging Hosts directory based on platform
 */
export function getNativeMessagingHostsDir() {
    const platform = os.platform();
    const homeDir = os.homedir();
    switch (platform) {
        case 'darwin':
            return path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts');
        case 'linux':
            return path.join(homeDir, '.config', 'google-chrome', 'NativeMessagingHosts');
        case 'win32':
            // Windows uses registry, but we can also write to a directory
            // For development, we'll use the user-specific directory
            return path.join(process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local'), 'Google', 'Chrome', 'User Data', 'NativeMessagingHosts');
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}
/**
 * Get the current executable path (VFS Service)
 */
export function getVfsServicePath() {
    // When running as compiled Node.js script
    // process.execPath is the node binary, but we need the script path
    // In production, this should be a bundled executable
    // For development, use the entry point
    const entryPoint = process.argv[1];
    // If running via node, construct the full command
    if (process.execPath.includes('node')) {
        // Return the script path with node prefix
        return `${process.execPath} ${entryPoint}`;
    }
    // In production, return the executable path directly
    return entryPoint;
}
/**
 * Create Native Messaging Host manifest
 */
export function createNativeMessagingManifest(extensionId, vfsServicePath) {
    return {
        name: 'com.chromehistoryrecorder.vfs',
        description: 'Virtual File System Service for Chrome History Recorder Extension',
        path: vfsServicePath || getVfsServicePath(),
        type: 'stdio',
        allowed_origins: [`chrome-extension://${extensionId}/`],
    };
}
/**
 * Get manifest file path
 */
export function getManifestPath() {
    const hostsDir = getNativeMessagingHostsDir();
    return path.join(hostsDir, 'com.chromehistoryrecorder.vfs.json');
}
/**
 * Register Native Messaging Host
 */
export function registerNativeHost(extensionId, vfsServicePath) {
    try {
        const hostsDir = getNativeMessagingHostsDir();
        const manifestPath = getManifestPath();
        // Create directory if it doesn't exist
        if (!fs.existsSync(hostsDir)) {
            fs.mkdirSync(hostsDir, { recursive: true, mode: 0o755 });
        }
        // Create manifest
        const manifest = createNativeMessagingManifest(extensionId, vfsServicePath);
        // Write manifest
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), {
            mode: 0o644,
            encoding: 'utf8',
        });
        return {
            success: true,
            manifestPath,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
            success: false,
            manifestPath: getManifestPath(),
            error: message,
        };
    }
}
/**
 * Check if Native Messaging Host is already registered
 */
export function isNativeHostRegistered() {
    const manifestPath = getManifestPath();
    return fs.existsSync(manifestPath);
}
/**
 * Get existing manifest content
 */
export function getExistingManifest() {
    const manifestPath = getManifestPath();
    if (!fs.existsSync(manifestPath)) {
        return null;
    }
    try {
        const content = fs.readFileSync(manifestPath, 'utf8');
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
/**
 * Update manifest with new extension ID
 */
export function updateNativeHost(extensionId, vfsServicePath) {
    return registerNativeHost(extensionId, vfsServicePath);
}
/**
 * Unregister Native Messaging Host
 */
export function unregisterNativeHost() {
    try {
        const manifestPath = getManifestPath();
        if (fs.existsSync(manifestPath)) {
            fs.unlinkSync(manifestPath);
        }
        return { success: true };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: message };
    }
}
//# sourceMappingURL=native-host-setup.js.map