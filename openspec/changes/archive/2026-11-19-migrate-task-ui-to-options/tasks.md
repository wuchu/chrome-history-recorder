## 1. Options event-driven queue state

- [x] 1.1 Add `useTaskQueue` hook under `entrypoints/options/hooks/` that subscribes to `chrome.runtime.onMessage` and reduces `queue:updated` (full replacement) and `task:scheduler` / `classify:scheduler` (scheduler-only) into `QueueStatus` (aggregate + `byType` + `scheduler`)
- [x] 1.2 Initialize the hook from `getQueueStatus()` on mount so a freshly opened Options page reflects current state
- [x] 1.3 Expose `start`, `pause`, `retryFailed`, `clearQueue`, and `requeueAll` actions wired to the existing `extension-runtime.ts` helpers
- [x] 1.4 Remove the queue-related surface (`queueStatus`, `refreshQueue`, `startClassification`, `pauseClassification`, `retryFailedTasks`, `clearQueue`) from `useOptionsData` once the console is wired to `useTaskQueue`

## 2. Options task console UI (rewrite in Ant Design)

- [x] 2.1 Build a `TaskConsole` component (Ant Design `Card`) showing per-type `classify` / `rename` progress bars with completed/total counts
- [x] 2.2 Add the start/pause switch, concurrency input, and current-processing count to the console
- [x] 2.3 Add retry-failed and clear-queue actions with Ant Design confirmation
- [x] 2.4 Replace the existing "AI 分类控制" and "分类队列" cards in `options/App.tsx` with the new console, keeping the rest of the page unchanged

## 3. Full rescan

- [x] 3.1 Add a "全量重扫" action to the console wired to `refreshAllTasks(['classify', 'rename'])` with confirmation

## 4. Dark mode for Options

- [x] 4.1 Read the shared `themeMode` key from `chrome.storage.local` and resolve effective dark/light from `auto` + `prefers-color-scheme`
- [x] 4.2 Apply `theme.darkAlgorithm` / `theme.defaultAlgorithm` in the Options `ConfigProvider`
- [x] 4.3 Make `options/style.css` dark-aware (backgrounds and custom tokens via CSS variables or a `[data-theme="dark"]` selector)
- [x] 4.4 Add an auto/light/dark selector to the Options header using the shared `themeMode` key

## 5. Side Panel cleanup

- [x] 5.1 Remove `ClassifyProgressSection`, `useClassifyQueue`, and `handleRefreshAll` from `sidepanel/App.tsx`
- [x] 5.2 Remove the `classifyQueue` prop and the classification/completed indicators from `StatusBar.tsx`
- [x] 5.3 Verify `useClassifyEvents` (CaptureStream per-file badges) and `handleRefreshTask` (MediaDetail quick action) remain intact

## 6. Dead code and barrel exports

- [x] 6.1 Delete `ClassifyProgressSection.tsx` and `ClassifyProgressSection.module.css`
- [x] 6.2 Delete `useClassifyQueue.ts` and remove its exports from `hooks/index.ts` and `hooks.ts`

## 7. Verification

- [x] 7.1 Run `pnpm lint` and `pnpm test` and fix any failures
- [ ] 7.2 Run `pnpm dev:extension` and manually verify: Options shows live per-type progress; start/pause/retry/clear/full-rescan work; dark mode toggles and persists; Side Panel no longer shows task progress but still shows capture-stream status badges
- [x] 7.3 Grep for any remaining imports of the removed modules and confirm none exist
