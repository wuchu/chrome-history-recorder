/**
 * Network listener for intercepting image and video requests in DevTools
 * This module runs in the DevTools panel context and monitors all network requests
 */

export interface MediaRequest {
  url: string;
  mimeType: string;
  size: number;
  request: any;
  type: 'image' | 'video';
}

export class NetworkListener {
  private isListening: boolean = false;
  private capturedImages: MediaRequest[] = [];
  private capturedVideos: MediaRequest[] = [];
  private skippedSvgCount: number = 0;
  private skippedVideoCount: number = 0;
  private failedImageCount: number = 0;
  private failedVideoCount: number = 0;
  private proxyEndpoint: string = 'http://localhost:3777';

  // Filter settings
  private enabledImageTypes: Set<string> = new Set([
    'image/jpeg',
    'image/png',
    'image/webp'
  ]);
  private enabledVideoTypes: Set<string> = new Set([
    'video/mp4',
    'video/webm'
  ]);
  private minFileSize: number = 10 * 1024; // 10KB default for images
  private minVideoSize: number = 1 * 1024 * 1024; // 1MB default for videos
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
   * Supported MIME types for video capture
   */
  private readonly SUPPORTED_VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/quicktime',  // MOV
    'video/x-msvideo',  // AVI
    'video/ogg'         // OGV
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
  private requestQueue: MediaRequest[] = [];
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

    // Check if request is an image or video
    const mimeType = this.getMimeType(request);
    if (!mimeType) {
      return; // No MIME type
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

    // Handle based on MIME type
    if (mimeType.startsWith('image/')) {
      // Handle SVG (special case - skip)
      if (mimeType === this.SVG_MIME_TYPE) {
        this.skippedSvgCount++;
        console.log(`Skipped SVG: ${url}`);
        return;
      }

      // Apply image filters
      if (!this.applyFilters(mimeType, size, url, 'image')) {
        return; // Filtered out
      }

      // Create media request object
      const mediaRequest: MediaRequest = {
        url,
        mimeType,
        size,
        request,
        type: 'image'
      };

      // Add to queue and process
      this.requestQueue.push(mediaRequest);
      this.processQueue();
    } else if (mimeType.startsWith('video/')) {
      // Apply video filters
      if (!this.applyFilters(mimeType, size, url, 'video')) {
        this.skippedVideoCount++;
        return; // Filtered out
      }

      // Create media request object
      const mediaRequest: MediaRequest = {
        url,
        mimeType,
        size,
        request,
        type: 'video'
      };

      // Add to queue and process
      this.requestQueue.push(mediaRequest);
      this.processQueue();
    }
  }

  /**
   * Apply filter rules
   */
  private applyFilters(mimeType: string, size: number, url: string, mediaType: 'image' | 'video'): boolean {
    if (mediaType === 'image') {
      // 1. Check image type filter
      if (!this.enabledImageTypes.has(mimeType)) {
        console.log(`Filtered out by image type: ${mimeType}`);
        return false;
      }

      // 2. Check file size filter for images
      if (size < this.minFileSize) {
        console.log(`Filtered out by image size: ${size} < ${this.minFileSize}`);
        return false;
      }
    } else if (mediaType === 'video') {
      // 1. Check video type filter
      if (!this.enabledVideoTypes.has(mimeType)) {
        console.log(`Filtered out by video type: ${mimeType}`);
        return false;
      }

      // 2. Check file size filter for videos
      if (size < this.minVideoSize) {
        console.log(`Filtered out by video size: ${size} < ${this.minVideoSize}`);
        return false;
      }
    }

    // 3. Check domain whitelist (applies to both)
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
      const mediaRequest = this.requestQueue.shift();
      if (mediaRequest) {
        this.activeRequests++;
        this.captureAndSendMedia(mediaRequest)
          .then(() => {
            this.activeRequests--;
            this.processQueue(); // Continue processing
          })
          .catch((error) => {
            console.error(`Failed to capture ${mediaRequest.type}:`, error);
            if (mediaRequest.type === 'image') {
              this.failedImageCount++;
            } else {
              this.failedVideoCount++;
            }
            this.activeRequests--;
            this.processQueue(); // Continue processing
          });
      }
    }
  }

  /**
   * Capture media content and send to proxy
   */
  private async captureAndSendMedia(mediaRequest: MediaRequest): Promise<void> {
    try {
      // Get content using DevTools API
      const content = await this.getMediaContent(mediaRequest.request);

      if (!content) {
        throw new Error('Failed to get media content');
      }

      // Send to proxy service (use same endpoint for both image and video)
      const response = await fetch(`${this.proxyEndpoint}/save-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: mediaRequest.url,
          mimeType: mediaRequest.mimeType,
          data: content
        })
      });

      if (!response.ok) {
        throw new Error(`Proxy returned ${response.status}`);
      }

      const result = await response.json();

      // Add to appropriate captured list
      const capturedItem: MediaRequest = {
        url: mediaRequest.url,
        mimeType: mediaRequest.mimeType,
        size: mediaRequest.size,
        request: {
          hash: result.hash,
          filename: result.filename,
          captureTime: new Date()
        },
        type: mediaRequest.type
      };

      if (mediaRequest.type === 'image') {
        this.capturedImages.push(capturedItem);
      } else {
        this.capturedVideos.push(capturedItem);
      }

      console.log(`Captured ${mediaRequest.type}: ${result.filename}`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get media content from request
   */
  private async getMediaContent(request: any): Promise<string | null> {
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
  getCapturedImages(): MediaRequest[] {
    return this.capturedImages;
  }

  /**
   * Get captured videos
   */
  getCapturedVideos(): MediaRequest[] {
    return this.capturedVideos;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      capturedImageCount: this.capturedImages.length,
      capturedVideoCount: this.capturedVideos.length,
      skippedSvgCount: this.skippedSvgCount,
      skippedVideoCount: this.skippedVideoCount,
      failedImageCount: this.failedImageCount,
      failedVideoCount: this.failedVideoCount,
      totalImageSize: this.capturedImages.reduce((sum, img) => sum + img.size, 0),
      totalVideoSize: this.capturedVideos.reduce((sum, vid) => sum + vid.size, 0)
    };
  }

  /**
   * Clear captured media
   */
  clearImages(): void {
    this.capturedImages = [];
  }

  clearVideos(): void {
    this.capturedVideos = [];
  }

  clearAll(): void {
    this.capturedImages = [];
    this.capturedVideos = [];
    this.skippedSvgCount = 0;
    this.skippedVideoCount = 0;
    this.failedImageCount = 0;
    this.failedVideoCount = 0;
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
   * Set enabled video types
   */
  setEnabledVideoTypes(types: string[]): void {
    this.enabledVideoTypes = new Set(types);
  }

  /**
   * Set minimum file size (in bytes) for images
   */
  setMinFileSize(size: number): void {
    this.minFileSize = size;
  }

  /**
   * Set minimum file size (in bytes) for videos
   */
  setMinVideoSize(size: number): void {
    this.minVideoSize = size;
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
      enabledVideoTypes: Array.from(this.enabledVideoTypes),
      minFileSize: this.minFileSize,
      minVideoSize: this.minVideoSize,
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