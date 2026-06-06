/**
 * Network listener for intercepting image requests in DevTools
 * This module runs in the DevTools panel context and monitors all network requests
 */

export interface ImageRequest {
  url: string;
  mimeType: string;
  size: number;
  request: any;
}

export class NetworkListener {
  private isListening: boolean = false;
  private capturedImages: ImageRequest[] = [];
  private skippedSvgCount: number = 0;
  private failedCount: number = 0;
  private proxyEndpoint: string = 'http://localhost:3777';

  // Filter settings
  private enabledImageTypes: Set<string> = new Set([
    'image/jpeg',
    'image/png',
    'image/webp'
  ]);
  private minFileSize: number = 10 * 1024; // 10KB default
  private domainWhitelist: Set<string> = new Set(); // Empty = all domains allowed

  /**
   * Supported MIME types for image capture
   */
  private readonly SUPPORTED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/x-icon',
    'image/vnd.microsoft.icon'
  ];

  /**
   * SVG MIME type (special handling - skipped)
   */
  private readonly SVG_MIME_TYPE = 'image/svg+xml';

  /**
   * Maximum concurrent requests to proxy
   */
  private readonly MAX_CONCURRENT = 5;

  /**
   * Request queue for managing concurrent uploads
   */
  private requestQueue: ImageRequest[] = [];
  private activeRequests: number = 0;

  /**
   * Start listening for network requests
   */
  startListening(): void {
    if (this.isListening) return;

    this.isListening = true;

    // Register network request listener
    chrome.devtools.network.onRequestFinished.addListener(this.handleRequest.bind(this));

    console.log('Network listener started');
  }

  /**
   * Stop listening for network requests
   */
  stopListening(): void {
    if (!this.isListening) return;

    this.isListening = false;

    // Remove network request listener
    chrome.devtools.network.onRequestFinished.removeListener(this.handleRequest.bind(this));

    console.log('Network listener stopped');
  }

  /**
   * Handle each network request
   */
  private async handleRequest(request: any): Promise<void> {
    if (!this.isListening) return;

    // Check if request is an image
    const mimeType = this.getMimeType(request);
    if (!mimeType || !mimeType.startsWith('image/')) {
      return; // Not an image
    }

    // Get URL
    const url = request.request.url;

    // Skip data: URLs and blob: URLs (not supported in first version)
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      console.warn(`Skipping unsupported URL type: ${url.substring(0, 50)}...`);
      return;
    }

    // Get file size from Content-Length header
    const size = this.getContentLength(request);

    // Handle SVG (special case - skip)
    if (mimeType === this.SVG_MIME_TYPE) {
      this.skippedSvgCount++;
      console.log(`Skipped SVG: ${url}`);
      return;
    }

    // Apply filters
    if (!this.applyFilters(mimeType, size, url)) {
      return; // Filtered out
    }

    // Create image request object
    const imageRequest: ImageRequest = {
      url,
      mimeType,
      size,
      request
    };

    // Add to queue and process
    this.requestQueue.push(imageRequest);
    this.processQueue();
  }

  /**
   * Apply filter rules
   */
  private applyFilters(mimeType: string, size: number, url: string): boolean {
    // 1. Check image type filter
    if (!this.enabledImageTypes.has(mimeType)) {
      console.log(`Filtered out by type: ${mimeType}`);
      return false;
    }

    // 2. Check file size filter
    if (size < this.minFileSize) {
      console.log(`Filtered out by size: ${size} < ${this.minFileSize}`);
      return false;
    }

    // 3. Check domain whitelist
    if (this.domainWhitelist.size > 0) {
      try {
        const hostname = new URL(url).hostname;
        if (!this.domainWhitelist.has(hostname)) {
          console.log(`Filtered out by domain: ${hostname}`);
          return false;
        }
      } catch (error) {
        console.warn(`Failed to parse URL: ${url}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Process request queue with concurrency control
   */
  private async processQueue(): Promise<void> {
    while (this.requestQueue.length > 0 && this.activeRequests < this.MAX_CONCURRENT) {
      const imageRequest = this.requestQueue.shift();
      if (imageRequest) {
        this.activeRequests++;
        this.captureAndSendImage(imageRequest)
          .then(() => {
            this.activeRequests--;
            this.processQueue(); // Continue processing
          })
          .catch((error) => {
            console.error('Failed to capture image:', error);
            this.failedCount++;
            this.activeRequests--;
            this.processQueue(); // Continue processing
          });
      }
    }
  }

  /**
   * Capture image content and send to proxy
   */
  private async captureAndSendImage(imageRequest: ImageRequest): Promise<void> {
    try {
      // Get image content using DevTools API
      const content = await this.getImageContent(imageRequest.request);

      if (!content) {
        throw new Error('Failed to get image content');
      }

      // Send to proxy service
      const response = await fetch(`${this.proxyEndpoint}/save-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: imageRequest.url,
          mimeType: imageRequest.mimeType,
          data: content
        })
      });

      if (!response.ok) {
        throw new Error(`Proxy returned ${response.status}`);
      }

      const result = await response.json();

      // Add to captured images list
      this.capturedImages.push({
        url: imageRequest.url,
        mimeType: imageRequest.mimeType,
        size: imageRequest.size,
        request: {
          hash: result.hash,
          filename: result.filename,
          captureTime: new Date()
        }
      });

      console.log(`Captured image: ${result.filename}`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get image content from request
   */
  private async getImageContent(request: any): Promise<string | null> {
    try {
      return new Promise((resolve, reject) => {
        request.getContent((content: string, encoding: string) => {
          if (!content) {
            reject(new Error('No content'));
            return;
          }

          // Handle different encodings
          if (encoding === 'base64') {
            // Already base64 encoded
            resolve(content);
          } else {
            // Need to convert to base64
            try {
              // For utf8 or other encodings, convert to base64
              const encoder = new TextEncoder();
              const bytes = encoder.encode(content);
              const base64 = btoa(String.fromCharCode(...bytes));
              resolve(base64);
            } catch (error) {
              reject(error);
            }
          }
        });
      });
    } catch (error) {
      console.error('Error getting content:', error);
      return null;
    }
  }

  /**
   * Get MIME type from response headers
   */
  private getMimeType(request: any): string | null {
    const headers = request.response.headers;
    for (const header of headers) {
      if (header.name.toLowerCase() === 'content-type') {
        return header.value;
      }
    }
    return null;
  }

  /**
   * Get content length from response headers
   */
  private getContentLength(request: any): number {
    const headers = request.response.headers;
    for (const header of headers) {
      if (header.name.toLowerCase() === 'content-length') {
        return parseInt(header.value, 10);
      }
    }
    return 0;
  }

  /**
   * Get captured images
   */
  getCapturedImages(): ImageRequest[] {
    return this.capturedImages;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      capturedCount: this.capturedImages.length,
      skippedSvgCount: this.skippedSvgCount,
      failedCount: this.failedCount,
      totalSize: this.capturedImages.reduce((sum, img) => sum + img.size, 0)
    };
  }

  /**
   * Clear captured images
   */
  clearImages(): void {
    this.capturedImages = [];
  }

  /**
   * Set proxy endpoint
   */
  setProxyEndpoint(endpoint: string): void {
    this.proxyEndpoint = endpoint;
  }

  /**
   * Set enabled image types
   */
  setEnabledImageTypes(types: string[]): void {
    this.enabledImageTypes = new Set(types);
  }

  /**
   * Set minimum file size (in bytes)
   */
  setMinFileSize(size: number): void {
    this.minFileSize = size;
  }

  /**
   * Set domain whitelist
   */
  setDomainWhitelist(domains: string[]): void {
    this.domainWhitelist = new Set(domains);
  }

  /**
   * Get current filter settings
   */
  getFilterSettings() {
    return {
      enabledImageTypes: Array.from(this.enabledImageTypes),
      minFileSize: this.minFileSize,
      domainWhitelist: Array.from(this.domainWhitelist)
    };
  }

  /**
   * Check if listening
   */
  isActive(): boolean {
    return this.isListening;
  }
}