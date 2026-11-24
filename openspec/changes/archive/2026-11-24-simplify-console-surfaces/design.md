## Context

The Options console currently exposes six sections (`概览 / 媒体库 / 标签 / 任务 / 回收站 / 设置`). Three patterns have become redundant:

- `MediaLibrary.tsx` renders a `ScrollableTabBar` alongside the unified search bar. The last search change made the tab bar a "shortcut", but it still owns a second tag-filtering state (`activeTagId`), tag-count fetching, and tab-specific query rewriting.
- `TrashPage.tsx` reimplements the library's masonry grid, selection mode, detail modal, and batch actions against `useHistoricalImages({ status: 'trashed' })`. The data hook already supports trashed listings.
- Tasks and Settings place low-frequency admin controls (prompt templates, clear/rescan, index maintenance, workspace path, per-host video overrides) beside daily controls.

The Side Panel and Overview are intentionally untouched by this change.

## Goals / Non-Goals

**Goals:**

- One tag-filtering model: the unified search bar.
- One media surface: the media library, with trash as a view.
- Console navigation reduced from six destinations to five.
- Two clear control tiers in Tasks and Settings.
- Remove duplicated grid/selection code and dead tab-bar code.

**Non-Goals:**

- Side Panel header, status bar, feed, and event-log changes.
- Overview changes of any kind.
- Renaming the shared `media-browser` UI kit.
- New query syntax, trash APIs, or storage changes.
- Changing permanent-delete or archive semantics.

## Decisions

### 1. Trash is a library view, not a query token and not a section

Add a `view: 'active' | 'trash'` field to the Options route. `MediaLibrary` is controlled by `view` / `onViewChange`; the shell remembers the last library view in `sessionStorage` under `media-library-view-v1` so returning to the Media Library tab restores it.

- `view === 'active'` → `useHistoricalImages({ status: 'active', ... })`, live events merged through `useCombinedMedia`.
- `view === 'trash'` → `useHistoricalImages({ status: 'trashed', orderBy: 'deleted_at', order: 'desc', ... })`, no live-merge; refresh on `file:trashed`, `file:restored`, `file:purged`, `trash:emptied`, and `trash:restored-all`.

Why not `status:trashed` in the query grammar: `status:` already means AI classification status (`pending / processing / completed / failed / skipped`). Overloading it would make `status:failed` ambiguous. Why not keep the sixth tab: it forces a second copy of the grid and selection system and hides trash from the "all media" mental model. Why not a standalone route: the user already decided trash belongs inside the library.

The trash view keeps the search input; the active query is applied to trashed media only. The view switch is a labeled segmented control with the trash count, not an unlabeled icon.

### 2. URL and hash compatibility

Extend `options/tabs.ts` to parse a route object rather than only a tab key:

- `#library` → `{ tab: 'library', view: 'active' }`
- `#library?view=trash` → `{ tab: 'library', view: 'trash' }`
- `#trash` → `{ tab: 'library', view: 'trash' }` (legacy deep link)
- missing/unknown → `{ tab: 'overview', view: 'active' }`

`handleTabChange('library')` restores the remembered view and writes `#library` or `#library?view=trash` with `history.replaceState`. The navigation rail keeps highlighting Media Library while the trash view is active. `isConsoleTab` no longer includes `trash`, but the parser still accepts it for compatibility.

### 3. Remove the tag tab bar completely

- Delete `MediaLibrary`'s `visibleTabs`, `activeTagId`, `handleTagTabChange`, `tagCounts` state, and the `ScrollableTabBar` render.
- Delete `ScrollableTabBar.tsx` / `.module.css` and its barrel export.
- Remove `getVisibleTabsFromVocabulary` from `shared/tag-utils.ts` if no other consumer remains.
- Keep `listTags({ limit: 500 })` for the suggestion vocabulary; suggestions already carry usage counts, so `getTagCounts` is no longer called from the library. Leave the RPC in place for now (no backend contract change), and remove the library call only.
- Tag discovery after removal: typing `tag:`, `#`, or a tag-like word shows vocabulary suggestions with counts and pinned state; selecting one inserts a `tag:` token. The applied chips remain the visible state.

### 4. Library header becomes a two-row toolbar

Row 1: title + view switch + total/connection status. Row 2: search input (flex) + sort + refresh + select. Chips, selection bar, export progress, and alerts render only when applicable. The masonry grid keeps its current position and behavior.

This is a layout change only; no search, sort, selection, or query behavior changes.

### 5. Settings uses a routine/advanced disclosure

- Routine section (expanded): appearance, Ollama model/endpoint/language/chat concurrency, video capture enable + size.
- Advanced section (collapsed `Collapse`): service status, media index maintenance, workspace path, enabled video formats, default capture mode, per-host overrides, gap filling.
- All existing controls and save paths are preserved; the collapse only changes default visibility.
- The workspace card keeps a one-line current-path summary outside the collapse if it remains cheap; otherwise it moves wholly into advanced.

### 6. Task cards lose duplicated chrome

- Keep the run/pause `Switch`, per-type concurrency, progress, and retry-failed.
- Remove the status `Tag` that repeats the Switch state.
- Move prompt templates into a per-card `Collapse` labeled "高级：提示词模板", closed by default.
- Move clear-queue and full-rescan into a `Dropdown` (`…`) inside the card; keep their confirmation dialogs.
- Media archive card keeps its current structure; it already has its own controls.

### 7. Detail modal action tiers

- Primary toolbar: previous/next, star, download, close.
- Overflow `…`: re-classify, re-name, and (in trash mode) restore.
- Delete stays as the separate danger button.
- Metadata: type, size, captured time stay visible; source URL, hash, deleted time, model, confidence collapse under "详情".
- Trash mode continues to swap primary actions for restore / permanent delete.

### 8. Data and event handling

- Trash count comes from `historical.total` in the trash view. Trash size can reuse the existing `getStats` response (`trashSize` / `trashFiles`) once on view entry; no new API.
- The trash view does not subscribe to the full event history. It uses the same `useBackgroundMessaging` listener as the library but filters to trash-related events and refreshes.
- When the view changes, reset pagination, selection, and any open detail item, mirroring the current filter-signature reset.

## Risks / Trade-offs

- **Trash becomes less discoverable when it leaves the navigation.** → Labeled view switch with a live count in the library header; keep `#trash` working; mention the new location in README.
- **Permanent delete sits one view away from normal browsing.** → Purge only exists in trash view, keeps danger styling and explicit confirmations, and the view shows a persistent "回收站" banner.
- **Search-only tag discovery may hide low-frequency tags.** → Suggestions search the full vocabulary up to 500 tags, show usage counts, and identify pinned tags; no tab-bar cap remains.
- **Hash routing regressions.** → Parser accepts `#trash`, `#library?view=trash`, `#library`, and unknown values; add unit tests for each.
- **Collapsing settings hides the workspace path.** → Keep a read-only one-line path summary in the routine area with an "高级" link, so users can still see where data goes.
- **Accidental cross-view actions.** → Selection clears on view change; active-only actions (trash) and trash-only actions (restore/purge) never render in the other view.
- **Dead code after tab-bar removal.** → Remove the component, CSS, barrel export, library state, and the tab helper together; run lint and tests.

## Migration Plan

- No persisted-data or API migration. The library view is remembered in a separate `sessionStorage` key and defaults to `active` when missing or unknown.
- Existing `#trash` links and bookmarks resolve to the library trash view.
- Rollback is a UI revert; no backend or data rollback needed.

## Open Questions

- Should trash size be shown next to the count, or is the count alone enough? (Design assumes count always, size when `getStats` succeeds.)
- Should the trash view allow sorting, or stay fixed to newest-deleted-first? (Design assumes fixed order to keep the view simple; status/date sort options that do not apply are hidden.)
