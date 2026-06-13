/**
 * VFS Service - Native Host Setup Module
 *
 * Handles automatic registration of Native Messaging Host manifest.
 */
/**
 * Native Messaging Host manifest structure
 */
interface NativeMessagingManifest {
    name: string;
    description: string;
    path: string;
    type: 'stdio';
    allowed_origins: string[];
}
/**
 * Get Chrome Native Messaging Hosts directory based on platform
 */
export declare function getNativeMessagingHostsDir(): string;
/**
 * Get the current executable path (VFS Service)
 */
export declare function getVfsServicePath(): string;
/**
 * Create Native Messaging Host manifest
 */
export declare function createNativeMessagingManifest(extensionId: string, vfsServicePath?: string): NativeMessagingManifest;
/**
 * Get manifest file path
 */
export declare function getManifestPath(): string;
/**
 * Register Native Messaging Host
 */
export declare function registerNativeHost(extensionId: string, vfsServicePath?: string): {
    success: boolean;
    manifestPath: string;
    error?: string;
};
/**
 * Check if Native Messaging Host is already registered
 */
export declare function isNativeHostRegistered(): boolean;
/**
 * Get existing manifest content
 */
export declare function getExistingManifest(): NativeMessagingManifest | null;
/**
 * Update manifest with new extension ID
 */
export declare function updateNativeHost(extensionId: string, vfsServicePath?: string): {
    success: boolean;
    manifestPath: string;
    error?: string;
};
/**
 * Unregister Native Messaging Host
 */
export declare function unregisterNativeHost(): {
    success: boolean;
    error?: string;
};
export {};
//# sourceMappingURL=native-host-setup.d.ts.map