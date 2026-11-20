## Context

The async AI task engine (`background/tasks/engine.ts`) processes typed `classify` and `rename` tasks and, via `FileManager.broadcastEvent`, broadcasts events with `chrome.runtime.sendMessage` — so every extension page (Side Panel and Options) already receives `queue:updated`, `task:*`, `*:scheduler`, and the legacy `classify:*` events without any background change.

Today the rich task UI lives in the Side Panel (`ClassifyProgressSection` + `useClassifyQueue`, event-driven), while the Options page has a simplified, poll-based "AI 分类控制" + "分类队列" view that only shows aggregate counts and never surfaces `rename`. This change consolidates the task console into Options, removes it from the Side Panel, makes Options event-driven, rewrites the UI natively in Ant Design, and adds dark mode.

## Goals / Non-Goals

**Goals:**

- Make the Options page the single control surface for async AI tasks (classify + rename).
- Drive Options queue/status UI from live background events, not polling.
- Render the task console in Options-native Ant Design (no CSS-module / react-i18next coupling).
- Add dark mode to Options, sharing the existing `themeMode` preference with the Side Panel.
- Keep Side Panel focused on capture + browsing; retain per-file capture-stream status badges and per-file requeue quick actions.

**Non-Goals:**

- No changes to the background `TaskEngine`, VFS WebSocket protocol, or message handlers.
- No changes to the persisted task queue model (VFS-backed) or configuration schema.
- Not fixing the legacy "DevTools" naming in existing spec requirement headers (out of scope).
- Not adding dark mode to any surface other than Options (Side Panel already has it via `useTheme`).

## Decisions

### 1. Rewrite the task console natively in Options (do not reuse `ClassifyProgressSection`)

The existing `ClassifyProgressSection` is tightly coupled to the Side Panel: it uses its own CSS module, `react-i18next` (which Options does not initialize), and its own `useTheme` dark-mode logic, and it renders as a compact single-line strip above the tab bar. Options renders a card-based Ant Design layout with a single `ConfigProvider`.

**Decision:** build a new `TaskConsole` section (and a small supporting `useTaskQueue` hook) inside `entrypoints/options` using Ant Design components, matching the existing Options cards. After migration, delete `ClassifyProgressSection.tsx` + its `.module.css`.

**Alternatives considered:** reuse `ClassifyProgressSection` directly (fast, but style/i18n mismatch and carries a dark-mode implementation inconsistent with Options' AntD theme); extract a shared "progress" primitive (premature — only one consumer remains).

### 2. Event-driven queue state via a focused Options hook, not `useBackgroundMessaging`

`useBackgroundMessaging` bundles connection status, captured-file accumulation, and an initial `get-status` round trip that Options does not need and that would duplicate `useOptionsData`'s `serviceStatus`.

**Decision:** add an Options-local `useTaskQueue` hook that:

- subscribes to `chrome.runtime.onMessage`,
- initializes from `getQueueStatus()` (already in `shared/extension-runtime.ts`),
- treats `queue:updated` as the **authoritative** full state (aggregate counts + `byType` + `scheduler`) and replaces local state wholesale,
- applies `task:scheduler` / `classify:scheduler` as scheduler-only updates,
- exposes `start`, `pause`, `retryFailed`, `clearQueue`, `requeueAll`.

**Rationale / drift avoidance:** `useClassifyQueue` maintains state through fragile incremental `task:*` arithmetic (increment/decrement pending/processing/completed/failed per event), which can drift. The engine already emits a full `queue:updated` snapshot after every task transition, so wholesale replacement is simpler and cannot drift. Incremental `task:*` handling is deliberately not ported.

**Alternative considered:** reuse `useClassifyQueue` + a thin `BackgroundEvent[]` producer (less new code, but inherits the drift-prone arithmetic and the 10s polling side effect).

### 3. Dark mode reuses the existing `themeMode` storage key and AntD dark algorithm

Options currently hardcodes a light gradient and `ConfigProvider` light token. The Side Panel's `useTheme` stores the preference under `chrome.storage.local` key `themeMode` (`auto` | `light` | `dark`).

**Decision:** Options reads the same `themeMode` key (so the two surfaces share one preference), computes effective dark/light from `auto` + `prefers-color-scheme`, applies `theme.darkAlgorithm` in its `ConfigProvider`, and makes `style.css` dark-aware (CSS variables or a `[data-theme="dark"]` selector). Add an auto/light/dark selector in the Options header.

**Alternative considered:** separate Options-only theme key (would desync the user's theme across surfaces).

### 4. Full rescan and queue maintenance consolidate into the console

The full-rescan control (currently `refreshAllTasks(['classify','rename'])` in the Side Panel) moves to Options. Retry-failed, clear-queue, start/pause, and concurrency stay on Options. All actions are already exposed by `shared/extension-runtime.ts` (`refreshAllTasks`, `retryFailedTasks`, `clearQueue`, `startClassification`, `pauseClassification`), so only UI wiring is needed. Full rescan and clear queue use AntD confirmation (Modal/Popconfirm), consistent with `extension-options-config`.

### 5. Side Panel cleanup is a strict removal

Remove `ClassifyProgressSection` and `useClassifyQueue` usage, the `handleRefreshAll` callback, and the `classifyQueue` prop + classification indicators from `StatusBar`. Keep `useClassifyEvents` (drives CaptureStream per-file badges) and `handleRefreshTask` (MediaDetail quick action). After removal, `ClassifyProgressSection.tsx`/`.module.css` and `useClassifyQueue.ts` become dead and are deleted; `useBackgroundMessaging` and `useClassifyEvents` remain because the Side Panel capture flow still needs them.

## Risks / Trade-offs

- **[Event listener not re-subscribed after Options reopen]** → Options page is reloaded on open, so the `onMessage` listener is re-registered on mount; initial `getQueueStatus()` fills any gap.
- **[Live events while Options is closed]** → background events are not persisted to the page; this is fine because every open re-runs the initial fetch.
- **[Removing `useClassifyQueue`/`ClassifyProgressSection` is a breaking internal change]** → tasks include a grep/verify step; the barrel exports (`components.ts`, `hooks.ts`, `hooks/index.ts`) are updated in the same change.
- **[Dark mode coverage in Options CSS]** → use AntD `darkAlgorithm` for components plus explicit dark tokens for the custom `style.css`; verify both themes in `pnpm dev:extension`.
- **[Queue status briefly stale between events]** → `queue:updated` is emitted after every task transition, so staleness is bounded; a manual "refresh queue" button remains as a fallback.

## Migration Plan

- No data migration: the task queue is VFS-backed and the theme/config keys are unchanged.
- Rollback: revert the commit. Specs are deltas and are only archived after implementation is verified.

## Open Questions

- **Theme selector granularity:** full auto/light/dark selector vs. a single dark-mode toggle. Leaning full selector to match the existing `themeMode` model; confirm during implementation.
- **`useClassifyQueue` fate:** delete vs. keep as a shared hook. Leaning delete (Options hook is Options-specific; the shared `QueueStatus`/`TaskTypeSummary` types in `extension-runtime.ts` already cover the shape).
