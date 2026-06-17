/**
 * VFS Service - HTTP Server Module
 *
 * Provides HTTP endpoints for file download, thumbnails, and stats.
 */

import http from 'http';
import { VFSAPI } from './api';
import { FileMetadata } from './sqlite';
import { ThumbnailSize } from './thumbnail';

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
export class VFSHTTPServer {
  private server: http.Server;
  private api: VFSAPI;
  private port: number;

  constructor(api: VFSAPI, config: HTTPServerConfig) {
    this.api = api;
    this.port = config.port;

    // Create HTTP server
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    this.setupServer(config.host || 'localhost');
  }

  /**
   * Setup HTTP server
   */
  private setupServer(host: string): void {
    this.server.listen(this.port, host, () => {
      console.error(`HTTP Server listening on port ${this.port}`);
    });

    this.server.on('error', (error: Error) => {
      console.error(`HTTP Server error: ${error.message}`);
    });
  }

  /**
   * Handle HTTP request
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Parse URL using the WHATWG URL API (legacy `url.parse` is deprecated; DEP0169).
    const requestHost = req.headers.host ?? 'localhost';
    const parsedUrl = new URL(req.url || '/', `http://${requestHost}`);
    const pathname = parsedUrl.pathname || '/';
    const query = parsedUrl.searchParams;

    try {
      // Route request
      if (pathname === '/') {
        this.handleRoot(res);
      } else if (pathname === '/health') {
        this.handleHealth(res);
      } else if (pathname === '/stats') {
        this.handleStats(res);
      } else if (pathname.startsWith('/files/')) {
        await this.handleFiles(res, pathname, query);
      } else {
        this.handleNotFound(res);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`HTTP request error: ${message}`);
      this.handleError(res, message);
    }
  }

  /**
   * Handle root endpoint - service info
   */
  private handleRoot(res: http.ServerResponse): void {
    const info = {
      name: 'VFS Service',
      version: '1.0.0',
      websocketPort: 8765,
      httpPort: this.port,
      endpoints: [
        '/files/:hash - Download file',
        '/files/:hash/thumbnail - Get thumbnail',
        '/files/:hash/metadata - Get file metadata',
        '/stats - Get statistics',
        '/health - Health check',
      ],
    };

    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(info));
  }

  /**
   * Handle health check endpoint
   */
  private handleHealth(res: http.ServerResponse): void {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', version: '1.0.0' }));
  }

  /**
   * Handle stats endpoint
   */
  private handleStats(res: http.ServerResponse): void {
    const stats = this.api.getStats();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'max-age=60');
    res.writeHead(200);
    res.end(JSON.stringify(stats));
  }

  /**
   * Handle files endpoints
   */
  private async handleFiles(
    res: http.ServerResponse,
    pathname: string,
    query: URLSearchParams
  ): Promise<void> {
    // Extract hash from path: /files/:hash/...
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      this.handleNotFound(res);
      return;
    }

    const hash = parts[1];
    const subpath = parts.length > 2 ? parts.slice(2).join('/') : '';

    // Route based on subpath
    if (subpath === 'thumbnail') {
      await this.handleThumbnail(res, hash, query);
    } else if (subpath === 'metadata') {
      this.handleMetadata(res, hash);
    } else if (subpath === '' || subpath === '/') {
      await this.handleFileDownload(res, hash);
    } else {
      this.handleNotFound(res);
    }
  }

  /**
   * Handle file download endpoint
   */
  private async handleFileDownload(res: http.ServerResponse, hash: string): Promise<void> {
    const result = this.api.getFile(hash);
    if (!result) {
      this.handleNotFound(res, 'File not found');
      return;
    }

    // Set response headers
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Length', result.size);
    res.setHeader('Cache-Control', 'max-age=3600');
    res.setHeader('Content-Disposition', `inline; filename="${hash}"`);

    res.writeHead(200);
    res.end(result.buffer);
  }

  /**
   * Handle thumbnail endpoint
   */
  private async handleThumbnail(
    res: http.ServerResponse,
    hash: string,
    query: URLSearchParams
  ): Promise<void> {
    // Get thumbnail size from query
    const sizeValue = query.get('size') ?? undefined;
    const size: ThumbnailSize = (sizeValue as ThumbnailSize) || 'medium';

    // Validate size
    const validSizes: ThumbnailSize[] = ['small', 'medium', 'large'];
    if (!validSizes.includes(size)) {
      this.handleError(res, 'Invalid thumbnail size', 400);
      return;
    }

    // Generate thumbnail
    const result = await this.api.getThumbnail({ hash, size });
    if (!result) {
      this.handleNotFound(res, 'Thumbnail not found');
      return;
    }

    // Set response headers
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Length', result.buffer.length);
    res.setHeader('Cache-Control', 'max-age=3600');

    res.writeHead(200);
    res.end(result.buffer);
  }

  /**
   * Handle metadata endpoint
   */
  private handleMetadata(res: http.ServerResponse, hash: string): void {
    const metadata = this.api.getMetadata(hash);
    if (!metadata) {
      this.handleNotFound(res, 'Metadata not found');
      return;
    }

    // Format metadata for response
    const formattedMetadata = this.formatMetadata(metadata);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'max-age=60');
    res.writeHead(200);
    res.end(JSON.stringify(formattedMetadata));
  }

  /**
   * Format metadata for HTTP response
   */
  private formatMetadata(metadata: FileMetadata): Record<string, unknown> {
    return {
      hash: metadata.hash,
      mimeType: metadata.mime_type,
      size: metadata.size,
      category: metadata.category,
      aiFilename: metadata.ai_filename,
      capturedAt: metadata.captured_at,
      classifiedAt: metadata.classified_at,
      confidence: metadata.confidence,
      sourceUrl: metadata.source_url,
      tags: metadata.tags,
      modelUsed: metadata.model_used,
      isStarred: metadata.is_starred,
      userNotes: metadata.user_notes,
    };
  }

  /**
   * Handle 404 Not Found
   */
  private handleNotFound(res: http.ServerResponse, message?: string): void {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(404);
    res.end(JSON.stringify({ error: message || 'Not found' }));
  }

  /**
   * Handle error response
   */
  private handleError(res: http.ServerResponse, message: string, statusCode: number = 500): void {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(statusCode);
    res.end(JSON.stringify({ error: message }));
  }

  /**
   * Close HTTP server
   */
  close(): void {
    this.server.close();
    console.error('HTTP Server closed');
  }
}

/**
 * Create HTTP server
 */
export function createHTTPServer(api: VFSAPI, config: HTTPServerConfig): VFSHTTPServer {
  return new VFSHTTPServer(api, config);
}
