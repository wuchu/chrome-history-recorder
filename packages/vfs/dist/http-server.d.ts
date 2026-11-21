/**
 * VFS Service - HTTP Server Module
 *
 * Provides HTTP endpoints for file download, thumbnails, and stats.
 */
import { VFSAPI } from './api';
/**
 * Default maximum size accepted by `POST /upload` (200 MiB).
 */
export declare const DEFAULT_MAX_UPLOAD_SIZE: number;
/**
 * Make an AI-generated name safe for a download header and a ZIP entry.
 */
export declare function sanitizeDownloadName(raw: string): string;
/**
 * Build a readable download name from AI metadata with a hash fallback.
 */
export declare function buildDownloadName(metadata: {
    hash: string;
    blob_ext: string;
    ai_filename?: string | null;
}): {
    fullName: string;
    asciiName: string;
    encodedName: string;
};
/**
 * HTTP Server configuration
 */
export interface HTTPServerConfig {
    port: number;
    host?: string;
    maxUploadSize?: number;
}
/**
 * HTTP Server class
 */
export declare class VFSHTTPServer {
    private server;
    private api;
    private port;
    private maxUploadSize;
    constructor(api: VFSAPI, config: HTTPServerConfig);
    /**
     * Setup HTTP server
     */
    private setupServer;
    /**
     * Handle HTTP request
     */
    private handleRequest;
    /**
     * Handle root endpoint - service info
     */
    private handleRoot;
    /**
     * Handle health check endpoint
     */
    private handleHealth;
    /**
     * Handle stats endpoint
     */
    private handleStats;
    /**
     * Handle `POST /upload`.
     */
    private handleUpload;
    /**
     * Read a single-valued request header.
     */
    private getHeaderValue;
    /**
     * Handle files endpoints
     */
    private handleFiles;
    /**
     * Handle file download endpoint
     */
    private handleFileDownload;
    /**
     * Handle thumbnail endpoint
     */
    private handleThumbnail;
    /**
     * Handle metadata endpoint
     */
    private handleMetadata;
    /**
     * Format metadata for HTTP response
     */
    private formatMetadata;
    /**
     * Handle 404 Not Found
     */
    private handleNotFound;
    /**
     * Handle error response
     */
    private handleError;
    /**
     * Get the bound port (useful when listening on port 0).
     */
    getPort(): number;
    /**
     * Close HTTP server
     */
    close(): void;
}
/**
 * Create HTTP server
 */
export declare function createHTTPServer(api: VFSAPI, config: HTTPServerConfig): VFSHTTPServer;
//# sourceMappingURL=http-server.d.ts.map