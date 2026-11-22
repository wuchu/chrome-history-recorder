/**
 * Media utilities for DevTools Panel.
 */

const VFS_HTTP_BASE_URL = 'http://localhost:8766';

export function buildVfsThumbnailUrl(
  hash: string,
  size: 'small' | 'medium' | 'large' = 'medium'
): string {
  return `${VFS_HTTP_BASE_URL}/files/${hash}/thumbnail?size=${size}`;
}

export function buildVfsFileUrl(hash: string): string {
  return `${VFS_HTTP_BASE_URL}/files/${hash}`;
}

/** Download URL that asks the server for an attachment disposition. */
export function buildVfsDownloadUrl(hash: string): string {
  return `${buildVfsFileUrl(hash)}?download=1`;
}

export interface VFSRawMediaItem {
  hash?: string;
  mimeType?: string;
  mime_type?: string;
  size?: number;
  capturedAt?: string;
  captured_at?: string;
  sourceUrl?: string | null;
  source_url?: string | null;
  sourceDomain?: string | null;
  source_domain?: string | null;
  category?: string;
  ai_filename?: string | null;
  tags?: string[] | string | null;
  confidence?: number;
  classified_at?: string | null;
  model_used?: string | null;
  classifyStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  is_starred?: number;
  user_notes?: string | null;
  is_deleted?: number;
  deleted_at?: string | null;
}

export interface NormalizedMediaItem {
  hash: string;
  mimeType: string;
  size: number;
  capturedAt: string;
  category?: string;
  ai_filename?: string;
  tags?: string[];
  confidence?: number;
  classified_at?: string;
  model_used?: string;
  classifyStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  deletedAt?: string;
  url: string;
  thumbnailUrl: string;
  sourceUrl?: string;
  sourceDomain?: string;
  isStarred?: boolean;
  notes?: string;
}

function normalizeTags(tags: VFSRawMediaItem['tags']): string[] | undefined {
  if (!tags) return undefined;
  if (Array.isArray(tags)) return tags;

  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
}

export function normalizeMediaItem(item: VFSRawMediaItem): NormalizedMediaItem | null {
  const hash = item.hash;
  const mimeType = item.mimeType ?? item.mime_type;

  if (!hash || !mimeType) {
    console.warn('[media] Dropping invalid media item:', item);
    return null;
  }

  return {
    hash,
    mimeType,
    size: item.size ?? 0,
    capturedAt: item.capturedAt ?? item.captured_at ?? new Date().toISOString(),
    category: item.category,
    ai_filename: item.ai_filename ?? undefined,
    tags: normalizeTags(item.tags),
    confidence: item.confidence,
    classified_at: item.classified_at ?? undefined,
    model_used: item.model_used ?? undefined,
    classifyStatus: item.classifyStatus,
    deletedAt: item.deleted_at ?? undefined,
    url: buildVfsFileUrl(hash),
    thumbnailUrl: buildVfsThumbnailUrl(hash),
    sourceUrl: item.sourceUrl ?? item.source_url ?? undefined,
    sourceDomain: item.sourceDomain ?? item.source_domain ?? undefined,
    isStarred: item.is_starred === 1,
    notes: item.user_notes ?? undefined,
  };
}
