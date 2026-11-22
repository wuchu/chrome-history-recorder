/**
 * HTTP media upload helper.
 *
 * Media bytes are streamed to the VFS HTTP server instead of being serialized
 * as a number array over the WebSocket. This keeps large images out of JSON
 * and avoids the WebSocket max-payload limit.
 */

export const VFS_HTTP_BASE_URL = 'http://localhost:8766';

export interface UploadMediaInput {
  buffer: ArrayBuffer | Uint8Array | number[];
  mimeType: string;
  sourceUrl?: string;
  capturedAt?: string;
}

export interface UploadMediaResult {
  hash: string;
  duplicate: boolean;
  restored?: boolean;
  size: number;
  mimeType?: string;
}

export type UploadMediaErrorKind = 'network' | 'http' | 'invalid-response';

export class UploadMediaError extends Error {
  readonly kind: UploadMediaErrorKind;
  readonly status?: number;

  constructor(kind: UploadMediaErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'UploadMediaError';
    this.kind = kind;
    this.status = status;
  }
}

function toRequestBody(buffer: UploadMediaInput['buffer']): Uint8Array {
  if (buffer instanceof Uint8Array) return buffer;
  if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
  return Uint8Array.from(buffer);
}

/**
 * Upload media bytes to `POST /upload`.
 *
 * Network failures and HTTP errors are surfaced as `UploadMediaError` so
 * callers can map them to user-facing one-shot reasons.
 */
export async function uploadMedia(
  input: UploadMediaInput,
  options: { baseUrl?: string; signal?: AbortSignal } = {}
): Promise<UploadMediaResult> {
  const baseUrl = (options.baseUrl ?? VFS_HTTP_BASE_URL).replace(/\/+$/, '');
  const body = toRequestBody(input.buffer);

  const headers: Record<string, string> = {
    'Content-Type': input.mimeType,
  };
  if (input.sourceUrl) headers['X-Source-Url'] = input.sourceUrl;
  if (input.capturedAt) headers['X-Captured-At'] = input.capturedAt;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers,
      body: body as BodyInit,
      signal: options.signal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload request failed';
    throw new UploadMediaError('network', `VFS upload failed: ${message}`);
  }

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new UploadMediaError(
      'invalid-response',
      `VFS upload returned a non-JSON response (${response.status})`,
      response.status
    );
  }

  if (!response.ok) {
    const message =
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `VFS upload failed (${response.status})`;
    throw new UploadMediaError('http', message, response.status);
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as { hash?: unknown }).hash !== 'string'
  ) {
    throw new UploadMediaError(
      'invalid-response',
      'VFS upload returned an invalid response',
      response.status
    );
  }

  const result = parsed as {
    hash: string;
    duplicate?: unknown;
    restored?: unknown;
    size?: unknown;
    mimeType?: unknown;
  };

  return {
    hash: result.hash,
    duplicate: result.duplicate === true,
    restored: result.restored === true ? true : undefined,
    size: typeof result.size === 'number' ? result.size : body.byteLength,
    mimeType: typeof result.mimeType === 'string' ? result.mimeType : input.mimeType,
  };
}
