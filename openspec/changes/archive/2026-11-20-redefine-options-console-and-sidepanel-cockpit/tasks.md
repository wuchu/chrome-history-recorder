## 1. Background Capture Session Foundation

- [x] 1.1 Add shared session contracts to `packages/extension/src/shared/extension-runtime.ts`: `CaptureSession`, `SessionCounters`, `SessionMediaItem`, `SessionEvent`, session snapshot, and runtime message types.
- [x] 1.2 Create a background capture-session store module that applies session events to counters, the bounded recent-items feed, the 200-entry event log, and the stopped-session summary.
- [x] 1.3 Add throttled `chrome.storage.session` snapshot writes and a `restore()` path that hydrates the session after a Background Service Worker restart.
- [x] 1.4 Enforce the single-session invariant in `DebuggerCaptureController.start()`: stop any active session before starting, make same-tab start idempotent, and ensure no two tabs report an active session.
- [x] 1.5 Track session tab identity in the Background: tab title, page URL, origin, and in-tab navigation updates; end the session on tab close and unexpected debugger detach.
- [x] 1.6 Emit `saved` and `duplicate` session events from the image capture path using the `saveFile` result, including hash, MIME type, size, source URL, page URL, and capture time.
- [x] 1.7 Emit `skipped` and `failed` session events from the existing image/video skip and error paths, preserving the human-readable reason.
- [x] 1.8 Emit `video:candidate` and `video:result` session events from `VideoDownloadManager` and update queued/downloading video counters.
- [x] 1.9 Correlate relayed AI events (`classify:*`, `task:*`, `file:classified`) to session hashes, emit `ai` session events, and update AI counters.
- [x] 1.10 Add `capture:get-session` and `capture:clear-log` runtime messages and wire them through `packages/extension/src/entrypoints/background/index.ts`.
- [x] 1.11 Add Vitest coverage for session lifecycle transitions, counter updates, log bounding, summary generation, snapshot restore, and single-session enforcement.

## 2. Side Panel Capture Cockpit

- [x] 2.1 Replace the global history/tag-tab wiring in `packages/extension/src/entrypoints/sidepanel/App.tsx` with session state and active-tab identity.
- [x] 2.2 Implement an active-tab identity hook using `chrome.tabs.query`, `tabs.onActivated`, `tabs.onUpdated`, and `windows.onFocusChanged`, including favicon, title, hostname, URL, and unsupported-page detection.
- [x] 2.3 Implement the four cockpit states: no session, session on active tab, session on another tab, and stopped-session summary.
- [x] 2.4 Implement the session-in-another-tab banner with session tab name, saved count, switch-to-tab, and stop-session actions.
- [x] 2.5 Implement the session metrics strip for saved, duplicate, skipped, failed, bytes, images, videos, and AI counts.
- [x] 2.6 Implement the session live capture feed with newest-first items, duplicate placeholders, no scroll stealing, pause/resume, and open-original-in-new-tab behavior.
- [x] 2.7 Implement the collapsed/expandable session event log with type filters, pause, clear, copyable source URLs, and 200-entry rendering.
- [x] 2.8 Implement the stopped-session summary with restart and open-media-library actions.
- [x] 2.9 Implement capture start confirmation when another session is active, and stop actions from both the session tab and the other-tab banner.
- [x] 2.10 Update the fixed cockpit header, frost-glass styling, content padding, and remove the global masonry/tag-tab/media-detail UI from the Side Panel.
- [x] 2.11 Update Side Panel i18n strings for the cockpit states, metrics, feed, event log, and summary.
- [x] 2.12 Add component tests for the four states, other-tab banner, feed behavior, event log, and session summary.

## 3. Options Console Shell

- [x] 3.1 Add a hash-routed Ant Design tab shell to the Options page with Overview, Media Library, Tags, Tasks, and Settings tabs, defaulting to Overview and falling back on unknown hashes.
- [x] 3.2 Build the Overview tab with service status, storage and media summary, AI queue snapshot, recent captures, and a read-only active-session card.
- [x] 3.3 Regroup the existing Options cards into the Tags, Tasks, and Settings tabs without changing their save/load behavior.
- [x] 3.4 Add an Options deep-link helper for the Side Panel and wire the Settings and Media Library handoff actions to it.
- [x] 3.5 Preserve the active tab across reloads and keep inactive tab panes mounted so the library retains its scroll position.
- [x] 3.6 Add component tests for tab routing, deep links, default/fallback behavior, and the Overview read-only session state.

## 4. Options Media Library

- [x] 4.1 Extract the shared media-browser library into an Options Media Library component and decouple Side Panel-specific fixed-top and window-scroll assumptions.
- [x] 4.2 Wire global `listFiles` loading, tag-driven filter tabs, primary tag badges, virtualized masonry, and infinite scroll.
- [x] 4.3 Wire media detail with preview, AI filename/hash title, and metadata including MIME type, size, capture time, hash, tags, and source URL.
- [x] 4.4 Wire detail delete plus per-item classify/rename requeue, and grid-item quick delete with confirmation and stable scroll.
- [x] 4.5 Wire live `file:captured`, `file:classified`/task, and `file:deleted` events with hash deduplication and no full list reload.
- [x] 4.6 Add empty, loading, and VFS-disconnected states for the library.
- [x] 4.7 Apply the shared `useTheme` light/dark wrapper and a full-width layout to the library while keeping the existing media styling.
- [x] 4.8 Add component tests for library loading, tag filtering, detail metadata, delete, requeue, and live updates.

## 5. Documentation and Verification

- [x] 5.1 Update `README.md`, `ARCHITECTURE.md`, and `packages/extension/README.md` with the new Options console and Side Panel cockpit roles, single-session behavior, and the library handoff.
- [x] 5.2 Run `pnpm lint`, `pnpm test`, and `pnpm build`; fix any failures introduced by the change.
- [x] 5.3 Manually verify: no-session start; session on active tab; passive tab switch banner; start-in-another-tab confirmation and cancel; stop from both surfaces; panel close and reopen; in-tab navigation; options tab deep links; library browse/delete/requeue; unsupported-page state.
- [x] 5.4 Verify that no VFS schema, `listFiles`, app API, or capture-rule behavior changed in the diff.
