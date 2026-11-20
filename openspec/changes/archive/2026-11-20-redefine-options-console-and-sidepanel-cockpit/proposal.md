## Why

The Side Panel currently carries two jobs that pull in opposite directions: it is both the global media browser (historical masonry grid, tag tabs, media details) and the tab-scoped capture control surface. The Options page is a single long settings scroll with no navigation and no resource-management role. As a result, users cannot tell which surface is for finding saved media and which is for monitoring what the current tab is capturing; switching tabs leaves a capture running invisibly, and capture diagnostics (`capture:skipped`, `capture:error`) are broadcast but never shown.

This change separates the two roles: **Options becomes the console** for global browsing, management, and configuration; **the Side Panel becomes a capture cockpit** bound to the current tab and its single active capture session.

## What Changes

- **Options becomes a tabbed console** with five tabs: Overview, Media Library, Tags, Tasks, Settings. The default tab is Overview.
- **Move the global media library from the Side Panel to Options** (MVP scope): tag-driven masonry browsing, media details, delete, and per-item classify/rename requeue. Search, source-site filtering, bulk actions, export, and notes/star editing are out of scope for this change.
- **Redefine the Side Panel as a tab-scoped capture cockpit**: active tab identity, capture control, session metrics, a session-scoped live capture feed, an expandable real-time event log, and a post-stop session summary. Global historical media browsing and global tag tabs are removed from the Side Panel. **BREAKING** for users who used the Side Panel as their media library.
- **Introduce a single global capture session**: only one tab may capture at a time. Starting capture in another tab requires confirmation and ends the previous session. A session is tab-scoped: it survives panel close and in-tab navigation, and ends on stop, tab close, debugger detach, or browser restart.
- **Make the Side Panel honest about the current tab**: when the active tab is not the session tab, the panel shows a session-in-another-tab banner with switch and stop actions instead of pretending the active tab is capturing.
- **Add session-scoped capture events**: saved, duplicate, skipped, failed, video candidate/result, and AI status correlated to the session's hashes, all carrying the session tab and page identity. The event log keeps a bounded recent history (200 entries).
- **Persist the session snapshot in `chrome.storage.session`** so closing the Side Panel or a service-worker restart does not lose the running session; a browser restart clears it.
- **No VFS/schema/API changes** in this change: the library keeps using the existing global `listFiles` contract, and no site-history or page-history query is added.
- **Site auto-capture is explicitly deferred**: its policy (manual session wins; auto-start only when no session exists) is documented in the design but not implemented here.

## Capabilities

### New Capabilities

- `capture-session`: single active capture session, tab/page identity, lifecycle, counters, session-scoped events, bounded event log, `storage.session` snapshot, and post-stop summary.
- `options-console`: the tabbed Options shell (Overview / Media Library / Tags / Tasks / Settings), tab navigation and deep-linking, Overview content, and the read-only active-session indicator.
- `options-media-library`: the global media library surface in Options: global history loading, masonry browsing, tag-driven tabs, media details, delete, and classify/rename requeue.

### Modified Capabilities

- `side-panel-media-browser`: the Side Panel shifts from the primary media browser to a tab-scoped capture cockpit. Media browsing, tag tabs, media details, grid deletion, and deletion-scroll requirements move out; active-tab identity, session states, metrics, live feed, event log, summary, and console handoff are added.
- `extension-options-config`: the Options page gains tabbed console navigation and an Overview tab; existing configuration sections are grouped under Tags, Tasks, and Settings.
- `multi-tag-filtering`: the tag tab bar is retargeted from the retired DevTools surface to the Options media library.

## Impact

- `packages/extension/src/background/debugger-capture.ts` — single-session enforcement, session identity, page-navigation handling, session-scoped events.
- `packages/extension/src/background/video-download.ts` — emit session-scoped video candidate/result events.
- `packages/extension/src/background/file-manager.ts` and `background/index.ts` — session snapshot messages, event relay, message types.
- New background capture-session store module — counters, bounded event log, `storage.session` snapshot.
- `packages/extension/src/entrypoints/sidepanel/` — replace the library-first App with the cockpit; remove global history/tag-tab wiring.
- `packages/extension/src/entrypoints/options/` — add the tab shell, Overview, and the Media Library tab; regroup existing cards.
- `packages/extension/src/entrypoints/media-browser/` — shared grid/detail/hooks are reused by Options; decouple Side Panel-specific fixed-top and window-scroll assumptions.
- `packages/extension/src/shared/extension-runtime.ts` — session and event message contracts.
- No changes to `packages/vfs`, `packages/app`, or the SQLite schema. Documentation (`README.md`, `ARCHITECTURE.md`, `packages/extension/README.md`) needs the new page roles.
