## 1. Console routing and shell

- [x] 1.1 Extend `packages/extension/src/entrypoints/options/tabs.ts` to parse `{ tab, view }`, drop `trash` from the nav tab list, and map legacy `#trash` plus `#library?view=trash` to the library trash view; keep unknown hashes falling back to Overview.
- [x] 1.2 Add unit tests for `readConsoleTabFromHash` covering `#overview`, `#library`, `#library?view=trash`, `#trash`, `#settings`, and an unknown hash.
- [x] 1.3 Remove the `trash` item from `NAV_ITEMS` and the `TrashPage` branch in `options/App.tsx`; pass the initial library view into `MediaLibrary` and keep the Media Library nav item selected in trash view.
- [x] 1.4 Delete `options/components/TrashPage.tsx` and any now-unused imports or CSS references.

## 2. Media library trash view

- [x] 2.1 Add `view: 'active' | 'trash'` to the stored library view in `MediaLibrary` (sessionStorage migration defaults missing values to `active`) and keep it in sync with `#library` / `#library?view=trash`.
- [x] 2.2 Select `useHistoricalImages` options per view: `active` for the library, `status: 'trashed'`, `orderBy: 'deleted_at'`, `order: 'desc'` for trash; skip `useCombinedMedia` live merging in trash view.
- [x] 2.3 Reset pagination, selection, and any open detail item when the view changes; hide the sort control and show fixed newest-deleted-first ordering in trash view.
- [x] 2.4 Render a labeled `媒体库 / 回收站 (n)` view switch in the library header; source the count from the trash listing total and show trash storage size from the existing `getStats` response when available.
- [x] 2.5 Wire single-item restore and purge through `restoreFile` / `purgeFile` with irreversible-action confirmations, refetching the trash listing and count after each action.
- [x] 2.6 Wire batch actions in selection mode: restore-selected, permanently-delete-selected, select-visible, clear-selection; hide classify, rename, and export actions in trash view.
- [x] 2.7 Wire restore-all and empty-trash global actions with confirmations and the trash empty state.
- [x] 2.8 Pass `mode="trash"` to `MediaDetail` in trash view so restore and permanent delete replace library curation actions.
- [x] 2.9 Restrict trash-view background event handling to `file:trashed`, `file:restored`, `file:purged`, `trash:emptied`, and `trash:restored-all`; do not retain or merge the full event history.
- [x] 2.10 Verify the trash view renders no capture controls and that switching views never shows stale items from the other view.

## 3. Remove the tag tab bar

- [x] 3.1 Remove `ScrollableTabBar` from `MediaLibrary`, along with `visibleTabs`, `activeTagId`, `handleTagTabChange`, and the `tagCounts` state and `getTagCounts` call.
- [x] 3.2 Delete `media-browser/components/ScrollableTabBar.tsx`, its CSS module, and its barrel export; remove `getVisibleTabsFromVocabulary` from `shared/tag-utils.ts` if no other consumer remains.
- [x] 3.3 Confirm tag discovery still works end to end through `tag:` tokens and suggestions (including system tags, OR groups, and pinned tags) and that no tab-bar-era imports remain.

## 4. Library toolbar and detail tiers

- [x] 4.1 Compact the library header into two rows: title + view switch + count/connection on row one; search + sort + refresh + select on row two; keep chips, selection bar, export progress, and alerts conditional.
- [x] 4.2 Move media-detail re-classify and re-name actions into an overflow menu; keep previous/next, star, download, delete, and close directly visible.
- [x] 4.3 Collapse secondary metadata (source URL, hash, deleted time, model, confidence) behind a 详情 disclosure while keeping type, size, and captured time visible.

## 5. Settings and task console

- [x] 5.1 Group Settings cards into expanded routine settings and a collapsed `高级与诊断` section; keep a read-only current workspace path summary outside the collapse.
- [x] 5.2 Confirm every advanced control keeps its existing save path, validation, and success/error feedback after moving under the collapse.
- [x] 5.3 Remove the duplicate scheduler-state `Tag` from AI task cards and keep the run/pause `Switch` as the single state indicator.
- [x] 5.4 Move prompt template editors into a collapsed `高级：提示词模板` disclosure per AI task card, preserving save, placeholder help, and restore-default behavior.
- [x] 5.5 Move clear-queue and full-rescan into a `…` menu while keeping retry-failed, concurrency, and progress visible; preserve all existing confirmations.
- [x] 5.6 Verify the media archive card is unchanged and the task page still reports per-type queue counts and scheduler state.

## 6. Cleanup and verification

- [x] 6.1 Remove dead imports, CSS, and exports left by the tab bar and Trash page; run `pnpm lint` and `pnpm format:check`.
- [x] 6.2 Update `README.md` and `ARCHITECTURE.md` where they describe a Trash console section or tag tab bar as the tag filter.
- [x] 6.3 Add or update tests for the tab parser, search-only tag filtering, and trash-view state transitions; run `pnpm test`.
- [x] 6.4 Manually verify in the built extension: `#trash` deep link, view switch count, search within trash, restore, purge confirmation, batch purge, empty trash, settings collapse, and task-card collapse.
- [x] 6.5 Confirm the Side Panel and Overview behave exactly as before this change.
