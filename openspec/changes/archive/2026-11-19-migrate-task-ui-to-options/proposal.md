## Why

The async AI task UI (per-type classify/rename progress, scheduler start/pause, queue maintenance, full rescan) currently lives in the Side Panel, while the Options page only has a simplified, poll-based classification/queue view. Task management is therefore split across two surfaces that have already diverged — the Side Panel is event-driven, Options is poll-only, and Options under-represents the `rename` task type entirely. Consolidating the task console into the Options page makes it the single control surface for AI tasks, keeps the Side Panel focused on capture + browsing, and gives Options live updates. Options also lacks the dark mode the rest of the extension already supports.

## What Changes

- **Remove** the async task UI from the Side Panel: drop `ClassifyProgressSection` and the classification status indicators (`classifying N · M pending` / completed count) from `StatusBar`. Keep the per-file capture-stream status badges and the per-file requeue quick actions, which are capture/media feedback rather than task management.
- **Add** a consolidated, event-driven async task console to the Options page: per-type (`classify` + `rename`) live progress, scheduler start/pause + concurrency, retry-failed, clear-queue, and full-rescan.
- **Rewrite** the progress/control UI natively in Ant Design to match the Options page style (no CSS-module / react-i18next coupling).
- **Make** Options queue/status updates event-driven (listen to `queue:updated`, `task:*`, `*:scheduler`) instead of poll-only.
- **Add** dark mode to the Options page (auto / system / manual), consistent with the rest of the extension.
- **Remove** now-dead Side Panel code paths (`useClassifyQueue` consumer, `handleRefreshAll`).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `classification-progress-display`: per-type progress display and refresh/full-rescan controls move from the Side Panel to the Options page; the layout changes from a compact single-line above the tag tab bar to an Options-native Ant Design card.
- `extension-classify-controls`: scheduler start/pause and queue maintenance become Options-only (the Side Panel no longer provides them); media quick-action requeue and rename-semantics requirements are unchanged.
- `extension-options-config`: the classification controls and queue maintenance sections become event-driven and per-type; add dark mode.
- `side-panel-media-browser`: remove classification status from the Side Panel service status and remove `ClassifyProgressSection` from the fixed top area.
- `dark-mode-support`: extend theme detection and manual switching to the Options page.

## Impact

- **Side Panel** — `entrypoints/sidepanel/App.tsx` (remove `ClassifyProgressSection`, `useClassifyQueue`, `handleRefreshAll`), `components/StatusBar.tsx` (remove classification indicators).
- **Options** — `entrypoints/options/App.tsx` (new task console, dark mode), `hooks/useOptionsData.ts` (event-driven queue status, per-type breakdown), `main.tsx`/`style.css` (Ant Design dark algorithm + theme).
- **Shared / background** — no change expected: the background `TaskEngine` already broadcasts `queue:updated` / `task:*` / `*:scheduler`, and `shared/extension-runtime.ts` already exposes `refreshAllTasks`, `retryFailedTasks`, `clearQueue`, `getQueueStatus`.
- **Media-browser** — `ClassifyProgressSection` and `useClassifyQueue` become unused by the Side Panel (removed, not repurposed); `useClassifyEvents` is retained for capture-stream badges.
