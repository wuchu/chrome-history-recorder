## 1. Configuration and migration

- [x] 1.1 Add `ollamaMaxConcurrency`, `classifyConcurrency`, `renameConcurrency`, `mediaArchiveConcurrency`, `classifyPaused`, and `renamePaused` to `AppConfig`, `DEFAULT_APP_CONFIG`, and `normalizeAppConfig` with integer clamping to `1–8`.
- [x] 1.2 Implement a legacy scheduling migration helper that maps `classificationConcurrency` to `ollamaMaxConcurrency` and `classificationPaused` to both `classifyPaused` and `renamePaused`; call it before merging defaults in `ConfigStore.load()` and `importLegacy()`.
- [x] 1.3 Update the extension `ExtensionConfig` mirror, defaults, and saving keys to use the new fields and remove the legacy scheduling fields.
- [x] 1.4 Add config tests for defaults, clamping, new-field precedence, legacy key dropping, and the legacy-paused migration case.

## 2. Ollama chat concurrency

- [x] 2.1 Add an `AsyncSemaphore` with FIFO waiters and dynamic capacity in `packages/ai/src` and export it for tests.
- [x] 2.2 Add `maxConcurrency` to `OllamaClientConfig` (default `1`), instantiate the semaphore, and update capacity from `updateConfig`.
- [x] 2.3 Wrap the `/api/chat` fetch in `callVision` with acquire/release in `finally`; create `AbortSignal.timeout` only after acquiring the slot.
- [x] 2.4 Add Ollama client tests for the in-flight cap, FIFO order, `/api/tags` exemption, timeout starting after acquisition, and slot release on failure.

## 3. Scheduler per-task concurrency and pause

- [x] 3.1 Replace the scheduler's single concurrency and paused values with per-type maps initialized from `ConfigStore`, and add update methods for per-type concurrency and pause.
- [x] 3.2 Change `tick()` to iterate task types, skip paused types, and claim with each type's own free slot count.
- [x] 3.3 Change `SchedulerStatus` to expose per-type `state`, `processing`, and `concurrency`, and update scheduler status events.
- [x] 3.4 Update app startup and config application in `packages/app/src/index.ts` to always start the scheduler loop and apply per-type settings.
- [x] 3.5 Add scheduler tests for independent pause, per-type quotas, no cross-type slot consumption, in-flight completion after pause, and the new status shape.

## 4. App RPC and archive configuration

- [x] 4.1 Add a `setTaskPaused` handler for `classify` and `rename`; keep `startClassification` / `pauseClassification` as aliases that apply to both AI types.
- [x] 4.2 Extend `MediaArchiveConfigUpdate` and `MediaArchiveStatus` with `concurrency`, and validate/clamp updates to `1–8`.
- [x] 4.3 Wire `ollamaMaxConcurrency`, per-type concurrency, and per-type pause through `applyConfig` to the AI client and scheduler.
- [x] 4.4 Add handler tests for per-type pause, alias behavior, and archive concurrency validation.

## 5. Media archive concurrency

- [x] 5.1 Refactor `drainTasks` into a concurrent pool that tracks in-flight copies and respects `mediaArchiveConcurrency` while keeping `maxTasksPerDrain` as a per-drain cap.
- [x] 5.2 Update archive `running`/status reporting to reflect active drain or in-flight copies, and keep queue/status events accurate.
- [x] 5.3 Ensure disabling the archive stops new claims and lets in-flight copies finish; verify re-enable still reconciles and runs.
- [x] 5.4 Add archive tests for default serial behavior, concurrency greater than one, in-flight cap, and disable behavior.

## 6. Extension transport and background

- [x] 6.1 Update `vfs-ws-client` for `setTaskPaused`, the new `SchedulerStatus` shape, and archive concurrency.
- [x] 6.2 Update Background message routing for per-type start/pause and legacy aliases, and mirror the new pause fields.
- [x] 6.3 Update `extension-runtime` types, defaults, and helpers for the new config fields and status shapes.
- [x] 6.4 Update `useTaskQueue` with per-type start/pause actions, per-type busy state, and per-type scheduler status.
- [x] 6.5 Update `useOptionsData` for the new saving keys and archive concurrency updates.

## 7. Options UI

- [x] 7.1 Build the dedicated Ollama card with availability, endpoint, vision model, output language, and chat concurrency plus chat-only/health-check-exempt helper text; remove Ollama status from the VFS service status card.
- [x] 7.2 Rework `TaskConsole` to remove the shared scheduler card and add per-card run/pause, concurrency, processing/limit, and type-scoped retry/rescan/clear actions while keeping prompt templates.
- [x] 7.3 Add the archive concurrency control to `MediaArchiveCard` and clarify that the enabled switch pauses archive processing and enqueueing.
- [x] 7.4 Update Options wiring/props/messages for the new controls and remove the global concurrency handler.
- [x] 7.5 Update or extend Options tests for the Ollama card, independent task switches, per-type concurrency, and archive concurrency.

## 8. Verification

- [x] 8.1 Run `pnpm test`, `pnpm lint`, and `pnpm build`.
- [x] 8.2 Verify migration from an old `config.json` and from extension legacy `chrome.storage`, including the `classificationPaused = false` case, through automated tests.
- [x] 8.3 Verify independent classify/rename pause, chat concurrency, and archive concurrency through automated tests (real-model manual run waived by the user).
- [x] 8.4 Run `openspec validate ollama-and-task-controls` (or the repository's supported validation command) and fix any spec format issues.
