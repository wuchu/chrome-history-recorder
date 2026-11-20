import { getSystemTagsForFile, isUncategorized, parseTags } from '../../shared/tag-utils';
import type { CombinedMediaItem } from '../media-browser/hooks/useCombinedMedia';

/**
 * Filter the merged (historical + live) media list by the active tag tab.
 *
 * System tabs use ids such as `system:image`; user tag tabs use the tag name
 * directly. The filter normalizes system ids before comparing.
 */
export function filterMediaByTag(
  items: CombinedMediaItem[],
  activeTag: string
): CombinedMediaItem[] {
  if (activeTag === 'all') return items;

  const tag = activeTag.startsWith('system:') ? activeTag.slice('system:'.length) : activeTag;

  return items.filter((item) => {
    const userTags = parseTags(item.tags);
    if (tag === 'uncategorized') {
      return isUncategorized(userTags.filter((entry) => !entry.startsWith('system:')));
    }
    if (tag === 'starred') {
      return userTags.includes('system:starred');
    }
    if (getSystemTagsForFile(item.mimeType, false).includes(tag)) {
      return true;
    }
    return userTags.includes(tag);
  });
}
