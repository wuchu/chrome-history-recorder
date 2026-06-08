/**
 * Type definitions for Chrome DevTools Network API
 */

export interface ChromeNetworkRequest {
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
  };
  response: {
    headers: Array<{ name: string; value: string }>;
    status: number;
    statusText: string;
    mimeType?: string;
  };
  getContent(callback: (content: string, encoding: string) => void): void;
}

export interface CapturedRequestInfo {
  hash: string;
  filename: string;
  captureTime: Date;
}
