/**
 * VFS Service - HTTP Server Module
 *
 * Provides HTTP endpoints for file download, thumbnails, and stats.
 */

import http from 'http';
import fs from 'fs';
import { InvalidMediaError, UploadEmptyError, UploadTooLargeError, VFSAPI } from './api';
import { FileMetadata } from './sqlite';
import { ThumbnailSize } from './thumbnail';

/**
 * Default maximum size accepted by `POST /upload` (200 MiB).
 */
export const DEFAULT_MAX_UPLOAD_SIZE = 200 * 1024 * 1024;

const WINDOWS_RESERVED_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

/**
 * Make an AI-generated name safe for a download header and a ZIP entry.
 */
export function sanitizeDownloadName(raw: string): string {
  let name = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '');

  if (!name) name = 'media';
  if (WINDOWS_RESERVED_NAMES.has(name.toLowerCase())) {
    name = `_${name}`;
  }
  return name.slice(0, 120) || 'media';
}

function sanitizeExtension(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 10) || 'bin'
  );
}

/**
 * Build a readable download name from AI metadata with a hash fallback.
 */
export function buildDownloadName(metadata: {
  hash: string;
  blob_ext: string;
  ai_filename?: string | null;
}): { fullName: string; asciiName: string; encodedName: string } {
  const extension = sanitizeExtension(metadata.blob_ext);
  let base = sanitizeDownloadName(metadata.ai_filename || metadata.hash);
  const suffix = `.${extension}`;
  if (base.toLowerCase().endsWith(suffix)) {
    base = base.slice(0, -suffix.length) || metadata.hash;
  }
  const fullName = `${base}${suffix}`;
  const asciiName =
    fullName
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\]/g, '_')
      .trim() || `${metadata.hash}.${extension}`;
  const encodedName = encodeURIComponent(fullName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return { fullName, asciiName, encodedName };
}

/**
 * Result of parsing a single-range `Range` header.
 *
 * `null` means no range was requested, `'invalid'` means the header is not a
 * satisfiable single range (multi-range requests are intentionally rejected),
 * and an object describes the inclusive byte interval.
 */
export type ParsedByteRange = { start: number; end: number } | null | 'invalid';

export function parseByteRange(header: string | undefined, size: number): ParsedByteRange {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return 'invalid';

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return 'invalid';
  if (size <= 0) return 'invalid';

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return 'invalid';
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(rawStart);
  if (!Number.isFinite(start) || start < 0 || start >= size) return 'invalid';

  let end = rawEnd ? Number(rawEnd) : size - 1;
  if (!Number.isFinite(end) || end < start) return 'invalid';
  end = Math.min(end, size - 1);

  return { start, end };
}

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
export class VFSHTTPServer {
  private server: http.Server;
  private api: VFSAPI;
  private port: number;
  private maxUploadSize: number;

  constructor(api: VFSAPI, config: HTTPServerConfig) {
    this.api = api;
    this.port = config.port;
    this.maxUploadSize = config.maxUploadSize ?? DEFAULT_MAX_UPLOAD_SIZE;

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
    // Large video uploads can legitimately exceed the default 5 minute
    // request timeout. Stall detection is handled by the client.
    this.server.requestTimeout = 0;

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
    // Echo the request origin so Private Network Access preflights, which may
    // not accept a wildcard origin, succeed for extension requests.
    const requestOrigin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', requestOrigin ?? '*');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Source-Url, X-Captured-At');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');

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
      if (pathname === '/upload') {
        if (req.method !== 'POST') {
          this.handleError(res, 'Method not allowed', 405);
          return;
        }
        await this.handleUpload(req, res);
      } else if (pathname === '/') {
        this.handleRoot(res);
      } else if (pathname === '/health') {
        this.handleHealth(res);
      } else if (pathname === '/stats') {
        this.handleStats(res);
      } else if (pathname.startsWith('/files/')) {
        await this.handleFiles(req, res, pathname, query);
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
        '/upload - Stream a media upload (POST)',
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
   * Handle `POST /upload`.
   */
  private async handleUpload(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const rawMimeType = this.getHeaderValue(req.headers['content-type']) ?? '';
    const mimeType = rawMimeType.split(';', 1)[0].trim().toLowerCase();

    if (!mimeType) {
      this.handleError(res, 'Missing Content-Type header', 400);
      return;
    }

    if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
      this.handleError(res, `Unsupported media type: ${mimeType}`, 415);
      return;
    }

    const declaredLength = Number.parseInt(
      this.getHeaderValue(req.headers['content-length']) ?? '',
      10
    );
    if (Number.isFinite(declaredLength) && declaredLength > this.maxUploadSize) {
      this.handleError(res, `Upload exceeds maximum size of ${this.maxUploadSize} bytes`, 413);
      res.once('finish', () => req.destroy());
      return;
    }

    try {
      const result = await this.api.saveFileFromStream({
        stream: req,
        mimeType,
        sourceUrl: this.getHeaderValue(req.headers['x-source-url']),
        capturedAt: this.getHeaderValue(req.headers['x-captured-at']),
        maxBytes: this.maxUploadSize,
        onSizeExceeded: () => {
          if (res.writableEnded) return;
          const body = JSON.stringify({
            error: `Upload exceeds maximum size of ${this.maxUploadSize} bytes`,
          });
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(413);
          res.end(body, () => req.destroy());
        },
      });

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(result));
    } catch (error) {
      if (res.writableEnded || res.destroyed) return;

      if (error instanceof UploadTooLargeError) {
        this.handleError(res, error.message, 413);
        res.once('finish', () => req.destroy());
        return;
      }

      if (error instanceof UploadEmptyError) {
        this.handleError(res, error.message, 400);
        return;
      }

      if (error instanceof InvalidMediaError) {
        this.handleError(res, error.message, 415);
        return;
      }

      const message = error instanceof Error ? error.message : 'Upload failed';
      if (req.destroyed) {
        console.error(`Upload interrupted: ${message}`);
        return;
      }
      console.error(`Upload failed: ${message}`);
      this.handleError(res, message, 500);
    }
  }

  /**
   * Read a single-valued request header.
   */
  private getHeaderValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  /**
   * Handle files endpoints
   */
  private async handleFiles(
    req: http.IncomingMessage,
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
      await this.handleFileDownload(req, res, hash, query);
    } else {
      this.handleNotFound(res);
    }
  }

  /**
   * Handle file download endpoint.
   *
   * Streams the blob from disk, supports a single byte range, and switches
   * between inline preview and attachment download.
   */
  private async handleFileDownload(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    hash: string,
    query: URLSearchParams
  ): Promise<void> {
    const blob = this.api.getBlobPath(hash);
    if (!blob) {
      this.handleNotFound(res, 'File not found');
      return;
    }

    const etag = `"${hash}"`;
    const lastModified = this.getLastModified(blob.path);
    const metadata = this.api.getMetadata(hash);
    const download = query.get('download') === '1' || query.get('download') === 'true';
    const range = parseByteRange(req.headers.range, blob.size);

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (lastModified) res.setHeader('Last-Modified', lastModified);

    if (download) {
      const name = buildDownloadName({
        hash,
        blob_ext: metadata?.blob_ext ?? 'bin',
        ai_filename: metadata?.ai_filename,
      });
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${name.asciiName}"; filename*=UTF-8''${name.encodedName}`
      );
    } else {
      res.setHeader('Content-Disposition', 'inline');
    }

    if (this.isNotModified(req.headers['if-none-match'], etag)) {
      res.writeHead(304);
      res.end();
      return;
    }

    if (range === 'invalid') {
      res.setHeader('Content-Range', `bytes */${blob.size}`);
      res.writeHead(416, { 'Content-Length': '0' });
      res.end();
      return;
    }

    res.setHeader('Content-Type', blob.mimeType);
    if (range) {
      const length = range.end - range.start + 1;
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${blob.size}`);
      res.setHeader('Content-Length', String(length));
    } else {
      res.setHeader('Content-Length', String(blob.size));
    }

    res.writeHead(range ? 206 : 200);

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(blob.path, range ?? undefined);
    const onClose = () => {
      if (!res.writableEnded) stream.destroy();
    };
    res.on('close', onClose);
    stream.on('error', (error) => {
      res.off('close', onClose);
      if (!res.headersSent) {
        this.handleError(res, error.message);
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  }

  private getLastModified(blobPath: string): string | undefined {
    try {
      return fs.statSync(blobPath).mtime.toUTCString();
    } catch {
      return undefined;
    }
  }

  private isNotModified(header: string | string[] | undefined, etag: string): boolean {
    if (!header) return false;
    const value = Array.isArray(header) ? header.join(',') : header;
    return value
      .split(',')
      .map((part) => part.trim())
      .some((part) => part === '*' || part === etag);
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
   * Get the bound port (useful when listening on port 0).
   */
  getPort(): number {
    const address = this.server.address();
    if (address && typeof address === 'object') {
      return address.port;
    }
    return this.port;
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
