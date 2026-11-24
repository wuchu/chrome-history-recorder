## Why

The Options console has accumulated parallel ways to do the same thing: the media library offers both a tag tab bar and `tag:` search, the Trash section is a 444-line page that duplicates the library's grid and selection logic, and the Tasks and Settings pages place routine controls next to low-frequency admin controls at the same visual level. Every duplicate makes the console harder to scan and doubles the maintenance surface. This change collapses the console to one filtering model, one media surface, and two explicit control tiers, without changing capture, storage, or AI behavior.

## What Changes

- **The media library becomes the only media surface.** The tag tab bar and `ScrollableTabBar` are removed. Tag filtering and discovery go exclusively through the unified search bar: `tag:` tokens, tag suggestions, and applied chips. Repeated tags (AND), `tag:a|b` (OR), and system tags keep working.
- **Trash becomes a view inside the media library.** The Trash console section and `TrashPage` are removed. The library header gains a `媒体库 / 回收站 (n)` view switch. The trash view reuses the same search, masonry grid, selection mode, and detail modal, with restore, permanent delete, restore-all, and empty-trash actions. `#trash` remains a valid deep link that opens the library in trash view.
- **Library header is compacted.** Title, total, connection state, refresh, and selection controls move into a two-row toolbar around the search input. The applied-condition row and selection bar appear only when relevant.
- **Settings gains a routine/advanced split.** Routine cards stay expanded. Service status, media index maintenance, workspace path, and niche video controls move into a collapsed "高级与诊断" section. No setting changes its persistence or behavior.
- **Task cards are de-duplicated.** Each card shows one scheduler state indicator instead of a Switch plus a redundant Tag. Prompt templates collapse behind an "高级：提示词模板" disclosure. Clear-queue and full-rescan move into a `…` menu; retry-failed, concurrency, and progress stay visible.
- **Media detail actions are tiered.** Star, download, and delete stay in the toolbar. Re-classify and re-name move into a `…` menu. Source URL, hash, model, and capture metadata collapse behind a "详情" disclosure.

## Capabilities

### New Capabilities

None. This change only modifies existing capabilities.

### Modified Capabilities

- `options-console`: navigation drops from six sections to five; the Trash section is removed; `#trash` becomes a media-library handoff.
- `options-media-library`: tag tab bar removed; trash view added; header layout and live-update behavior adjusted; detail actions tiered.
- `trash-management`: trash operations are exposed through the library's trash view; lifecycle and storage rules are unchanged.
- `multi-tag-filtering`: scrollable tab bar requirement removed; tag discovery is search-suggestion only.
- `system-tabs-always-visible`: capability retired together with the tab bar.
- `extension-options-config`: task cards collapse templates and duplicate status; Settings gains routine/advanced grouping.

## Impact

- Extension UI only: `packages/extension/src/entrypoints/options/**`, `entrypoints/media-browser/components/ScrollableTabBar*`, `shared/tag-utils.ts`, and Options CSS.
- Removes `TrashPage.tsx`; reuses `VirtualMasonryGrid`, `MediaDetail`, and `useHistoricalImages` with `status: 'trashed'`.
- No changes to Background capture, VFS, AI, or app packages; no new permissions; no persisted-data migration.
- Existing `#trash` links keep working; unsupported hashes still fall back to Overview.

## Non-Goals

- Side Panel header and event-log simplification (separate change).
- Any change to the Overview section.
- Renaming `entrypoints/media-browser` to a shared-UI name (separate cleanup).
- New search syntax such as `in:trash`: trash is a view, not a query token.
- Changes to trash lifecycle APIs, permanent-delete semantics, or archive behavior.
