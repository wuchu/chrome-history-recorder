## Context

### Current State
- The system uses a single `category` field for classification
- There's also a `tags` JSON array field that's currently unused by the classifier
- DevTools Panel has simple MediaTabs with only "images" and "videos" options
- Options page has no tag management UI
- The ollama-classifier returns a single category and empty tags array

### Constraints
- Must maintain backward compatibility with existing database
- No data migration required (per user request)
- Use existing code patterns in the codebase

## Goals / Non-Goals

**Goals:**
- Add tag management UI in Options page
- Support multi-tag classification (system + user tags)
- Add scrollable tag tab bar for filtering
- Make AI classifier select from user-defined tags
- Separate system tags (immutable) from user tags (mutable)

**Non-Goals:**
- Database schema migration (use existing fields with compatible format)
- Size/duration-based system tags (removed from scope)
- Multi-tag selection (single tag only)

## Decisions

### Decision 1: Data model - reuse existing `tags` field
**Rationale:** Avoid database migration. Store tags in the existing `tags` field as a JSON array, with a naming convention to distinguish system vs user tags.

**Alternatives considered:**
- Add separate `system_tags` and `user_tags` columns: Requires DB migration, rejected
- Prefix-based namespacing in single `tags` array: `system:image`, `user:cat` - simple and backward compatible, **selected**

**Format:**
- System tags: `system:<name>` (e.g., `system:image`, `system:starred`)
- User tags: `<name>` (e.g., `cat`, `screenshot`) - no prefix

### Decision 2: Tag configuration storage in ExtensionConfig
**Rationale:** Leverage existing config infrastructure.

**Type Definition:**
```typescript
export interface TagDefinition {
  id: string;              // unique identifier (e.g., "system:image", "user:cat")
  name: string;            // internal name (e.g., "image", "cat")
  label: string;           // display name (may include emoji, e.g., "📷 图片")
  isSystem: boolean;       // true for system tags
  sortOrder: number;       // for ordering
}

export interface ExtensionConfig {
  // ... existing fields
  userDefinedTags: TagDefinition[];  // user-defined tags
}
```

### Decision 3: System tags implementation
**Rationale:** Simple implementation that doesn't require storing in DB.

**Implementation:**
- System tags are hardcoded in the codebase
- `system:image`/`system:video` are determined dynamically from mime_type when reading files
- `system:starred` is determined from is_starred field
- `system:uncategorized` is a virtual tag for files with no user tags
- System tags are not written to the `tags` field (computed on read)

### Decision 4: AI Classifier prompt update
**Rationale:** Guide AI to select from user-defined tags.

**Prompt format (Chinese):**
```
识别这张图片。
可用标签: {tags.join(', ')}

输出格式: 标签1,标签2 | 文件名

从"可用标签"中选择1-3个最合适的标签，用逗号分隔。
文件名用中文（不含扩展名），15-25个字以内，简洁生动。
风格要求: {stylePrompt}
示例: 猫咪,截图 | 慵懒的黑白猫咪在窗台晒太阳
```

**Parsing:** Split by "|" first, then split tags by comma. Filter tags against userDefinedTags, limit to 3.

### Decision 5: UI Component - ScrollableTabBar
**Rationale:** Reusable component for tag tabs.

**Props:**
```typescript
interface ScrollableTabBarProps {
  tabs: Array<{
    id: string;
    label: string;
    count?: number;
  }>;
  activeTabId: string;
  onTabChange: (tabId: string) => void;
}
```

**Implementation:** Use CSS `overflow-x: auto` for scrolling, custom scroll buttons for better UX.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Existing category field becomes unused | Keep writing to category for backward compatibility, but prioritize tags |
| Tag list can get long | Only show tags with files, use scrollable UI |
| AI might not follow tag instructions | Add validation to filter invalid tags, graceful fallback |
| Computed system tags could be inconsistent | Centralize tag logic in a single utility function |

## Open Questions

None - all scope decisions finalized.
