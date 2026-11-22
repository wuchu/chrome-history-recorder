/**
 * Extension Background - Assembly HTTP client
 *
 * Talks to the local VFS service's buffered-assembly endpoints. The service
 * owns the temporary file and the authoritative coverage ledger.
 */

const DEFAULT_BASE_URL = 'http://localhost:8766';

export interface AssemblyJobRef {
  jobId: string;
  token: string;
}

export interface AssemblyCreateInput {
  totalSize: number;
  mimeType: string;
  sourceUrl?: string;
  pageUrl?: string;
  capturedAt?: string;
}

export interface AssemblyUploadResult {
  hash: string;
  duplicate: boolean;
  size: number;
  mimeType?: string;
}

export class AssemblyRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly missingBytes?: number,
    readonly totalSize?: number
  ) {
    super(message);
    this.name = 'AssemblyRequestError';
  }
}

async function throwForResponse(response: Response, fallback: string): Promise<never> {
  const text = await response.text().catch(() => '');
  let message = text || fallback;
  let missingBytes: number | undefined;
  let totalSize: number | undefined;

  if (text) {
    try {
      const parsed = JSON.parse(text) as {
        error?: string;
        missingBytes?: number;
        totalSize?: number;
      };
      if (typeof parsed.error === 'string') message = parsed.error;
      if (typeof parsed.missingBytes === 'number') missingBytes = parsed.missingBytes;
      if (typeof parsed.totalSize === 'number') totalSize = parsed.totalSize;
    } catch {
      // Keep the raw text.
    }
  }

  throw new AssemblyRequestError(response.status, message, missingBytes, totalSize);
}

export class AssemblyClient {
  constructor(private readonly baseUrl: string = DEFAULT_BASE_URL) {}

  async createJob(input: AssemblyCreateInput): Promise<AssemblyJobRef> {
    const response = await fetch(`${this.baseUrl}/assemblies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!response.ok) {
      await throwForResponse(response, `Assembly create failed (${response.status})`);
    }
    return (await response.json()) as AssemblyJobRef;
  }

  async writeChunk(
    job: AssemblyJobRef,
    offset: number,
    bytes: Uint8Array
  ): Promise<{ receivedBytes?: number }> {
    const response = await fetch(
      `${this.baseUrl}/assemblies/${encodeURIComponent(job.jobId)}/chunks?offset=${offset}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Assembly-Token': job.token,
        },
        // `Uint8Array` is a valid fetch body at runtime; the DOM lib's
        // `BodyInit` union is narrower than the runtime accepts.
        body: bytes as unknown as BodyInit,
        credentials: 'omit',
        cache: 'no-store',
      }
    );
    if (!response.ok) {
      await throwForResponse(response, `Assembly chunk failed (${response.status})`);
    }
    const received = Number.parseInt(response.headers.get('x-assembly-received') ?? '', 10);
    return { receivedBytes: Number.isFinite(received) ? received : undefined };
  }

  async complete(job: AssemblyJobRef): Promise<AssemblyUploadResult> {
    const response = await fetch(
      `${this.baseUrl}/assemblies/${encodeURIComponent(job.jobId)}/complete`,
      {
        method: 'POST',
        headers: { 'X-Assembly-Token': job.token },
        credentials: 'omit',
        cache: 'no-store',
      }
    );
    if (!response.ok) {
      await throwForResponse(response, `Assembly finalize failed (${response.status})`);
    }
    return (await response.json()) as AssemblyUploadResult;
  }

  async abort(job: AssemblyJobRef): Promise<void> {
    const response = await fetch(`${this.baseUrl}/assemblies/${encodeURIComponent(job.jobId)}`, {
      method: 'DELETE',
      headers: { 'X-Assembly-Token': job.token },
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!response.ok && response.status !== 404) {
      await throwForResponse(response, `Assembly abort failed (${response.status})`);
    }
  }
}
