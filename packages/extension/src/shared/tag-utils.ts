/**
 * Tag utilities
 */
import type { TagDefinition } from './extension-runtime';

/**
 * System tag definitions
 */
export const SYSTEM_TAGS: TagDefinition[] = [
  { id: 'system:image', name: 'image', label: '📷 图片', isSystem: true, sortOrder: 1 },
  { id: 'system:video', name: 'video', label: '🎬 视频', isSystem: true, sortOrder: 2 },
  { id: 'system:starred', name: 'starred', label: '⭐ 已收藏', isSystem: true, sortOrder: 100 },
  {
    id: 'system:uncategorized',
    name: 'uncategorized',
    label: '未分类',
    isSystem: true,
    sortOrder: 999,
  },
];

/**
 * Special "all" tab
 */
export const ALL_TAG: TagDefinition = {
  id: 'all',
  name: 'all',
  label: '全部',
  isSystem: true,
  sortOrder: 0,
};

/**
 * Get all system tags
 */
export function getSystemTags(): TagDefinition[] {
  return SYSTEM_TAGS;
}

/**
 * Get system tags for a file based on metadata
 */
export function getSystemTagsForFile(mimeType: string, isStarred: boolean): string[] {
  const tags: string[] = [];
  if (mimeType.startsWith('image/')) {
    tags.push('image');
  } else if (mimeType.startsWith('video/')) {
    tags.push('video');
  }
  if (isStarred) {
    tags.push('starred');
  }
  return tags;
}

/**
 * Check if a file is uncategorized (no user tags)
 */
export function isUncategorized(userTags: string[] | null | undefined): boolean {
  return !userTags || userTags.length === 0;
}

/**
 * Parse tags string to array
 */
export function parseTags(tagsStr: string | string[] | null | undefined): string[] {
  if (!tagsStr) return [];
  if (Array.isArray(tagsStr)) return tagsStr;
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Get the primary content tag (first non-system tag) of a media item.
 */
export function getPrimaryTag(tags: string[] | string | null | undefined): string | null {
  const parsed = Array.isArray(tags) ? tags : parseTags(tags);
  return parsed.find((tag) => !tag.startsWith('system:')) ?? null;
}

/**
 * Split tags into system and user tags
 */
export function splitTags(tags: string[]): { systemTags: string[]; userTags: string[] } {
  const systemTags: string[] = [];
  const userTags: string[] = [];
  for (const tag of tags) {
    if (tag.startsWith('system:')) {
      systemTags.push(tag);
    } else {
      userTags.push(tag);
    }
  }
  return { systemTags, userTags };
}

/**
 * Combine system and user tags for storage
 */
export function combineTags(systemTags: string[], userTags: string[]): string[] {
  return [...systemTags, ...userTags];
}

/**
 * Check if a tag is a system tag
 */
export function isSystemTag(tagIdOrName: string): boolean {
  return SYSTEM_TAGS.some((t) => t.id === tagIdOrName || t.name === tagIdOrName);
}
