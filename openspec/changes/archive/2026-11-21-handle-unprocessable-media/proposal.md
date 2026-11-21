## Why

Some captured media can never be classified by the current vision pipeline. The capture layer accepts `image/x-icon` and `image/bmp`, but the bundled `sharp`/libvips build cannot decode either format, and the classifier's fallback only accepts JPEG/PNG/WebP/GIF originals. A single ICO therefore burns a deterministic set of attempts — `classify` and `rename` each retry three times, regenerating the same doomed thumbnail on every attempt — and both end as `failed`.

Because `failed` is also the transient-failure state, the system cannot tell "Ollama timed out" from "this format will never work": the queue is blocked by a resource that can never succeed, retry budgets are spent on impossible work, and the user's "retry failed / full rescan" actions resurrect the same poison. The task engine needs to distinguish **transient failure** from **media that is not applicable to the AI pipeline**, and it must make that determination before a task enters the pending queue.

## What Changes

- **Add AI media eligibility preflight (A).** The `ai` package exposes a pure eligibility decision built from the actual capabilities of the bundled pipeline: native vision formats ∪ thumbnail-decodable formats ∪ video. Every enqueue path (automatic ingest, manual enqueue, requeue, full rescan, retry-failed) consults it. Ineligible media never produces a `pending` task.
- **Add permanent-error classification (B).** When a representative image cannot be produced at runtime (unsupported format, corrupt media, no extractable video frame), the classifier raises a typed permanent error instead of a generic one. The scheduler terminates the task after a single attempt as `skipped`, with the reason recorded; no backoff and no retry-budget consumption.
- **Add a `skipped` task status.** Terminal, not claimable, counted in queue status, and durable across restarts. Automatic enqueue of ineligible media records `skipped` tasks directly, so the UI can explain *why* a file has no AI result instead of leaving it unqueued or permanently failed.
- **Make maintenance actions eligibility-aware.** `retryFailedTasks` moves ineligible failed rows to `skipped` rather than `pending`; full rescan never resets ineligible rows to `pending`; single-item requeue of ineligible media reports an actionable reason.
- **Reconcile on startup.** Existing `pending`/`failed` rows for ineligible media are converted to `skipped` when the app starts, so pre-existing poison disappears from the failed count without manual cleanup.
- **Surface the new outcome.** Queue status and the Options Overview gain a `skipped` count; progress treats `skipped` as settled instead of stalling below 100%; progress error styling is driven by `failed` only; the Side Panel session AI status and per-file badges distinguish "skipped / not applicable" from "failed".
- **Emit skip events.** `task:skipped` plus `classify:skipped` / `rename:skipped` carry `task_type`, `hash`, and the reason.
- **No capture change.** ICO/BMP remain capturable, browsable, and archivable. Capture and archive capabilities are intentionally untouched: the file is still worth keeping; only the AI pipeline declines it.
- **No database migration.** `tasks.status` is an unconstrained TEXT column, so `skipped` is additive. The queue-status aggregation must be extended because it currently drops unknown status names.
- **Out of scope:** adding ICO/BMP decoding or transcoding; reclassifying Ollama model/HTTP errors as permanent; a per-resource runtime verdict shared between `classify` and `rename` for corrupt-but-eligible media (preflight already removes the known class).

## Capabilities

### New Capabilities

- `ai-media-eligibility`: the AI pipeline's media eligibility contract — which media can produce a representative image, how that decision is shared by `classify` and `rename`, and how permanent ineligibility is distinguished from transient failure.

### Modified Capabilities

- `app-task-scheduler`: failure handling splits permanent vs transient; automatic ingest and maintenance actions honor eligibility; startup reconciliation converts pre-existing ineligible tasks to `skipped`.
- `task-queue`: new terminal `skipped` status; claim exclusion; queue counts and totals; skip events; eligibility-aware requeue and full rescan.
- `ollama-classifier`: representative-image resolution exposes eligibility and raises typed permanent errors instead of generic ones.
- `ai-auto-rename`: rename honors the shared eligibility verdict and skips unprocessable media without retrying.
- `thumbnail-generation`: exposes the set of image MIME types the bundled decoder can actually read, so eligibility is derived from real capabilities rather than a hardcoded list.
- `websocket-events`: task/classification event contract gains the skipped outcome.
- `capture-session`: session AI status and counters distinguish skipped media from failures.
- `classification-progress-display`: progress math and visual state account for skipped tasks.
- `options-console`: Overview queue summary includes skipped counts.
- `extension-classify-controls`: retry-failed and single-item requeue no longer resurrect ineligible media; reasons are surfaced.

## Impact

- `packages/ai/src/` — new eligibility module, permanent error type, representative-image contract, classifier/rename integration.
- `packages/vfs/src/sqlite.ts`, `packages/vfs/src/api.ts` — `TaskStatus` widening, skip transition, atomic skipped enqueue, eligibility-aware retry/rescan SQL, queue-status counts, startup reconciliation query.
- `packages/vfs/src/thumbnail.ts` — decoder-capability query.
- `packages/app/src/index.ts`, `scheduler.ts`, `handlers.ts` — ingest preflight, error taxonomy, skip events, startup reconciliation.
- `packages/extension/src/` — task status types, event mapping, session AI counters, TaskConsole/Overview rendering, requeue error messaging, i18n strings.
- `openspec/specs/*` — the capabilities listed above.
