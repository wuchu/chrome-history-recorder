/**
 * VFS Service - HTTP Server Module
 *
 * Provides HTTP endpoints for file download, thumbnails, and stats.
 */
import { VFSAPI } from './api';
/**
 * HTTP Server configuration
 */
export interface HTTPServerConfig {
    port: number;
    host?: string;
}
/**
 * HTTP Server class
 */
export declare class VFSHTTPServer {
    private server;
    private api;
    private port;
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
     * Close HTTP server
     */
    close(): void;
}
/**
 * Create HTTP server
 */
export declare function createHTTPServer(api: VFSAPI, config: HTTPServerConfig): VFSHTTPServer;
//# sourceMappingURL=http-server.d.ts.map