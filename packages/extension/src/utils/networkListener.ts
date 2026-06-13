/**
 * Network listener for intercepting image and video requests in DevTools
 * This module runs in the DevTools panel context and monitors all network requests
 *
 * Updated: Now sends media to Background Service Worker instead of HTTP proxy
 */

import type { ChromeNetworkRequest } from './networkTypes';

export interface MediaRequest {
  hash: string;
  url: string;
  mimeType: string;
  size: number;
  type: 'image' | 'video';
  captureTime: Date;
}

export class NetworkListener {
  private isListening: boolean = false;
  private capturedImages: MediaRequest[] = [];
  private capturedVideos: MediaRequest[] = [];
  private skippedSvgCount: number = 0;
  private skippedVideoCount: number = 0;
  private failedImageCount: number = 0;
  private failedVideoCount: number = 0;
  private boundHandleRequest: (request: ChromeNetworkRequest) => Promise<void>;

  // Filter settings
  private enabledImageTypes: Set<string> = new Set(['image/jpeg', 'image/png', 'image/webp']);
  private enabledVideoTypes: Set<string> = new Set(['video/mp4', 'video/webm']);
  private minFileSize: number = 10 * 1024; // 10KB default for images
  private minVideoSize: number = 1 * 1024 * 1024; // 1MB default for videos
  private maxFileSize: number = 50 * 1024 * 1024; // 50MB max file size
  private domainWhitelist: Set<string> = new Set();

  private readonly SUPPORTED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/x-icon',
    'image/vnd.microsoft.icon',
  ];

  private readonly SUPPORTED_VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/ogg',
  ];

  private readonly SVG_MIME_TYPE = 'image/svg+xml';
  private readonly MAX_CONCURRENT = 5;
  private requestQueue: MediaRequest[] = [];
  private activeRequests: number = 0;

  constructor() {
    this.boundHandleRequest = this.handleRequest.bind(this);
  }

  startListening(): void {
    if (this.isListening) return;
    this.isListening = true;
    chrome.devtools.network.onRequestFinished.addListener(this.boundHandleRequest);
    console.log('[NetworkListener] Started');
  }

  stopListening(): void {
    if (!this.isListening) return;
    this.isListening = false;
    chrome.devtools.network.onRequestFinished.removeListener(this.boundHandleRequest);
    console.log('[NetworkListener] Stopped');
  }

  private async handleRequest(request: ChromeNetworkRequest): Promise<void> {
    if (!this.isListening) return;

    const mimeType = this.getMimeType(request);
    if (!mimeType) return;

    const url = request.request.url;
    if (url.startsWith('data:') || url.startsWith('blob:')) return;

    const size = this.getContentLength(request);

    // Handle based on MIME type
    if (mimeType.startsWith('image/')) {
      if (mimeType === this.SVG_MIME_TYPE) {
        this.skippedSvgCount++;
        return;
      }

      if (!this.applyFilters(mimeType, size, url, 'image')) return;

      const mediaRequest: MediaRequest = {
        hash: '', // Will be set after capture
        url,
        mimeType,
        size,
        type: 'image',
        captureTime: new Date(),
      };

      this.requestQueue.push(mediaRequest);
      this.processQueue(request);
    } else if (mimeType.startsWith('video/')) {
      if (!this.applyFilters(mimeType, size, url, 'video')) {
        this.skippedVideoCount++;
        return;
      }

      const mediaRequest: MediaRequest = {
        hash: '',
        url,
        mimeType,
        size,
        type: 'video',
        captureTime: new Date(),
      };

      this.requestQueue.push(mediaRequest);
      this.processQueue(request);
    }
  }

  private applyFilters(mimeType: string, size: number, url: string, mediaType: 'image' | 'video'): boolean {
    if (mediaType === 'image') {
      if (!this.enabledImageTypes.has(mimeType)) return false;
      if (size < this.minFileSize) return false;
    } else {
      if (!this.enabledVideoTypes.has(mimeType)) return false;
      if (size < this.minVideoSize) return false;
    }

    // Check max file size
    if (size > this.maxFileSize) {
      console.log(`[NetworkListener] Skipping large file: ${size} > ${this.maxFileSize}`);
      return false;
    }

    // Check domain whitelist
    if (this.domainWhitelist.size > 0) {
      try {
        const hostname = new URL(url).hostname;
        if (!this.domainWhitelist.has(hostname)) return false;
      } catch {
        return false;
      }
    }

    return true;
  }

  private async processQueue(originalRequest: ChromeNetworkRequest): Promise<void> {
    while (this.requestQueue.length > 0 && this.activeRequests < this.MAX_CONCURRENT) {
      const mediaRequest = this.requestQueue.shift();
      if (mediaRequest) {
        this.activeRequests++;
        this.captureAndSendMedia(mediaRequest, originalRequest)
          .then(() => {
            this.activeRequests--;
            this.processQueue(originalRequest);
          })
          .catch((error) => {
            console.error(`[NetworkListener] Capture failed:`, error);
            if (mediaRequest.type === 'image') {
              this.failedImageCount++;
            } else {
              this.failedVideoCount++;
            }
            this.activeRequests--;
            this.processQueue(originalRequest);
          });
      }
    }
  }

  private async captureAndSendMedia(mediaRequest: MediaRequest, request: ChromeNetworkRequest): Promise<void> {
    // Get content using DevTools API
    const content = await this.getMediaContent(request);
    if (!content) {
      throw new Error('Failed to get media content');
    }

    // Convert base64 to ArrayBuffer
    const buffer = Uint8Array.from(atob(content), (c) => c.charCodeAt(0));

    // Send to Background via chrome.runtime.sendMessage.
    // Chrome runtime messages are JSON-serialized, so send bytes as number[].
    const response = await chrome.runtime.sendMessage({
      type: 'capture:media',
      data: {
        buffer: Array.from(buffer),
        mimeType: mediaRequest.mimeType,
        url: mediaRequest.url,
        capturedAt: mediaRequest.captureTime.toISOString(),
      },
    });

    if (!response?.success) {
      throw new Error(response?.error ?? 'Background capture failed');
    }

    // Update hash from response
    mediaRequest.hash = response.data.hash;

    if (response.data.duplicate) {
      console.log(`[NetworkListener] Duplicate skipped: ${mediaRequest.hash}`);
      return;
    }

    // Add only new captures to local list
    if (mediaRequest.type === 'image') {
      this.capturedImages.push(mediaRequest);
    } else {
      this.capturedVideos.push(mediaRequest);
    }

    console.log(`[NetworkListener] Captured: ${mediaRequest.hash}`);
  }

  private async getMediaContent(request: ChromeNetworkRequest): Promise<string | null> {
    try {
      return new Promise((resolve, reject) => {
        request.getContent((content: string, encoding: string) => {
          if (!content) {
            reject(new Error('No content'));
            return;
          }

          if (encoding === 'base64') {
            resolve(content);
          } else {
            try {
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
    } catch {
      return null;
    }
  }

  private getMimeType(request: ChromeNetworkRequest): string | null {
    const headers = request.response.headers;
    for (const header of headers) {
      if (header.name.toLowerCase() === 'content-type') {
        return header.value;
      }
    }
    return null;
  }

  private getContentLength(request: ChromeNetworkRequest): number {
    const headers = request.response.headers;
    for (const header of headers) {
      if (header.name.toLowerCase() === 'content-length') {
        return parseInt(header.value, 10);
      }
    }
    return 0;
  }

  getCapturedImages(): MediaRequest[] {
    return this.capturedImages;
  }

  getCapturedVideos(): MediaRequest[] {
    return this.capturedVideos;
  }

  getStats() {
    return {
      capturedImageCount: this.capturedImages.length,
      capturedVideoCount: this.capturedVideos.length,
      skippedSvgCount: this.skippedSvgCount,
      skippedVideoCount: this.skippedVideoCount,
      failedImageCount: this.failedImageCount,
      failedVideoCount: this.failedVideoCount,
      totalImageSize: this.capturedImages.reduce((sum, img) => sum + img.size, 0),
      totalVideoSize: this.capturedVideos.reduce((sum, vid) => sum + vid.size, 0),
    };
  }

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

  setEnabledImageTypes(types: string[]): void {
    this.enabledImageTypes = new Set(types);
  }

  setEnabledVideoTypes(types: string[]): void {
    this.enabledVideoTypes = new Set(types);
  }

  setMinFileSize(size: number): void {
    this.minFileSize = size;
  }

  setMinVideoSize(size: number): void {
    this.minVideoSize = size;
  }

  setMaxFileSize(size: number): void {
    this.maxFileSize = size;
  }

  setDomainWhitelist(domains: string[]): void {
    this.domainWhitelist = new Set(domains);
  }

  getFilterSettings() {
    return {
      enabledImageTypes: Array.from(this.enabledImageTypes),
      enabledVideoTypes: Array.from(this.enabledVideoTypes),
      minFileSize: this.minFileSize,
      minVideoSize: this.minVideoSize,
      maxFileSize: this.maxFileSize,
      domainWhitelist: Array.from(this.domainWhitelist),
    };
  }

  isActive(): boolean {
    return this.isListening;
  }
}