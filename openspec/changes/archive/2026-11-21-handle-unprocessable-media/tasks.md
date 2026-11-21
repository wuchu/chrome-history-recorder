## 1. Eligibility foundation (ai + vfs capabilities)

- [x] 1.1 Add `getDecodableImageMimeTypes()` to `packages/vfs/src/thumbnail.ts`, deriving supported input MIME types from `sharp.format` (map format ids to MIME types, exclude unmappable ids, log once).
- [x] 1.2 Expose the decoder capability set through `VFSAPI` (`packages/vfs/src/api.ts`) and the dispatcher if the extension needs it; add a vfs test asserting ICO/BMP are absent and JPEG/PNG/WebP/GIF/TIFF are present.
- [x] 1.3 Add `packages/ai/src/eligibility.ts` exporting the native vision MIME set and a pure `evaluateMediaEligibility({ mimeType, decodableMimeTypes })` returning `{ eligible: true }` or `{ eligible: false, reason: 'unsupported-format', message }`; cover native, thumbnail-decodable, video, and ICO/BMP cases in `packages/ai/test/eligibility.test.ts`.
- [x] 1.4 Add `UnprocessableMediaError` (reasons `unsupported-format`, `no-representative-frame`, `invalid-media`) and `isUnprocessableMediaError()` to `packages/ai`; export from `packages/ai/src/index.ts` with tests.
- [x] 1.5 Extend `MediaReader` with a metadata/mime accessor so the classifier can check eligibility without reading bytes; update `getRepresentativeImage` to use it, restrict the original-file fallback to native vision formats, and throw the typed error instead of generic `Error`.
- [x] 1.6 Update `packages/ai/test/ollama-client.test.ts` for the ICO path (no fetch call), missing video frame, invalid bytes, and unchanged transient error messages.

## 2. Task engine: skipped status and eligibility-aware SQL

- [x] 2.1 Widen `TaskStatus` to include `skipped` and add `skipped` to `TaskStatusSummary` in `packages/vfs/src/sqlite.ts`.
- [x] 2.2 Add the `skipped` transition to `updateTaskStatus` (set status/error, clear `next_run_at` and `started_at`, leave `attempts` and `completed_at` unchanged).
- [x] 2.3 Add `recordSkippedTask({ taskType, hash, error })`: create a skipped row when absent, convert `pending`/`failed` rows, preserve `completed` rows.
- [x] 2.4 Fix `getQueueStatus` so `skipped` is counted per type and in `total` (initialize the new field in the summary).
- [x] 2.5 Add `ineligibleMimeTypes` support to `retryFailedTasks` and `requeueAll`: eligible rows reset to pending, ineligible rows become `skipped` in the same transaction.
- [x] 2.6 Add `skipIneligibleTasks({ ineligibleMimeTypes, error })` that converts persisted `pending`/`failed` rows joined to ineligible `files.mime_type` values; return the converted count.
- [x] 2.7 Add `packages/vfs/test/` coverage for skipped claim exclusion, counts/totals, upsert conflict behavior, retry/rescan splits, and startup reconciliation.

## 3. App scheduler, ingest, and handlers

- [x] 3.1 In `packages/app/src/scheduler.ts`, classify handler errors with `isUnprocessableMediaError()`: permanent → `skipped` with reason and `task:skipped`/`classify:skipped`/`rename:skipped` events, no attempts increment, no backoff; transient → existing path.
- [x] 3.2 Add one app-side enqueue helper that evaluates eligibility (using the `ai` predicate plus `api.getDecodableImageMimeTypes()`) and calls `recordSkippedTask` or `enqueueTask` accordingly; route ingest, `enqueuePair`, `enqueueTask`, and `enqueueClassification` through it.
- [x] 3.3 Make `packages/app/src/handlers.ts` eligibility-aware: `requeueTask` returns `{ success: false, reason, error }` for ineligible hashes, `requeueAll`/`retryFailedTasks` pass `ineligibleMimeTypes` from the app, and queue broadcasts include skipped.
- [x] 3.4 In `packages/app/src/index.ts`, compute the ineligible MIME set at startup and call `api.skipIneligibleTasks(...)` before `scheduler.start()`/`recoverStale`; log the converted count and emit a queue update when non-zero.
- [x] 3.5 Extend `packages/app/test/scheduler.test.ts`: permanent error yields one attempt + skipped (no retry), transient error still retries, ingest of an ICO records two skipped rows without occupying the scheduler.
- [x] 3.6 Add a handler test for retry-failed/rescan splits and for the single-item ineligible requeue response.

## 4. Events and extension state plumbing

- [x] 4.1 Verify skip events flow through `EventBus` → `wsServer.broadcastEvent`; add event payload types where the app declares them.
- [x] 4.2 Update extension task types: `TaskStatus`/`VFSTaskStatus` and queue summary types in `packages/extension/src/shared/extension-runtime.ts` and `packages/extension/src/background/vfs-ws-client.ts` gain `skipped`.
- [x] 4.3 Map `task:skipped`/`classify:skipped`/`rename:skipped` in `packages/extension/src/background/file-manager.ts`, `entrypoints/background/index.ts` (`recordSessionAiEvent`), `useCombinedMedia`, and `useBackgroundMessaging`.
- [x] 4.4 Add `aiSkipped` to session counters in `capture-session-store.ts` and the shared counter type; ensure skipped does not increment `aiFailed`.

## 5. Extension UI

- [x] 5.1 Update `options/components/TaskConsole.tsx`: show skipped counts, compute percent as `(completed + skipped) / total`, keep exception styling tied to `failed`, and expose the skip reason.
- [x] 5.2 Update `options/components/OverviewTab.tsx` (and any queue summary card) to display the skipped count.
- [x] 5.3 Update Side Panel session surfaces (`SessionMetrics`, `SessionSummary`, `SessionFeed`, `SessionEventLog`) with a distinct skipped AI state/icon.
- [x] 5.4 Update media library quick actions to show the skipped state and surface the ineligibility message after a requeue of unsupported media.
- [x] 5.5 Add i18n strings for skipped/not-applicable and ineligibility messages in the extension locales.

## 6. Verification and documentation

- [x] 6.1 Run `pnpm test`, `pnpm lint`, and `pnpm format:check`; fix regressions.
- [x] 6.2 Manual: capture an ICO (or upload one), confirm two `skipped` rows, zero retries, no scheduler slot consumption, and correct queue counts in Options.
- [x] 6.3 Manual: retry-failed and full rescan with a mix of ICO and normal images; confirm the ICO stays skipped and normal images process.
- [x] 6.4 Manual: start the app with a pre-existing failed ICO row; confirm startup reconciliation converts it to skipped.
- [x] 6.5 Update `ARCHITECTURE.md`/`README.md` (or the closest AI/task docs) with the eligibility contract and `skipped` semantics.
