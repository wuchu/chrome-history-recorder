## Context

The AI pipeline is `ingest → enqueuePair(classify, rename) → Scheduler.runTask → OllamaClient`. Classification and rename both begin by producing a representative image:

1. `VFSAPI.getThumbnail(hash, 'large')` — `sharp` for images, `ffmpeg` frame extraction for video.
2. Fallback to the original blob when no thumbnail exists, but only for `image/jpeg|png|webp|gif` and never for video.
3. Otherwise the handler throws a generic `Error`.

The capture layer accepts `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/bmp`, `image/tiff`, `image/x-icon`, and `image/vnd.microsoft.icon`. The bundled `sharp` 0.33.5 / libvips 8.15.3 decodes `jpeg, png, webp, tiff, gif, svg, heif, jp2k, jxl, raw`; it has no ICO or BMP loader (the ImageMagick loader is compiled out). So `image/x-icon` and `image/bmp` are captured but can never produce a representative image.

The scheduler treats every handler error identically: increment attempts, back off, retry up to `max_attempts`, then `failed`. Two task types per file means six guaranteed attempts per unfixable resource, each regenerating the same doomed thumbnail. `failed` is also the transient-failure state, so retry buttons resurrect the poison. This change introduces an explicit eligibility decision for the AI pipeline and a terminal `skipped` outcome.

## Goals / Non-Goals

**Goals:**

- Decide eligibility *before* a task enters the pending queue, using the real capabilities of the bundled pipeline.
- Record ineligible media as a visible, terminal `skipped` task with a reason, so the UI explains the absence of AI results.
- Terminate runtime "cannot produce a representative image" errors after one attempt without touching the retry budget.
- Keep retry, full rescan, requeue, and startup recovery from resurrecting ineligible work.
- Keep transient failures (Ollama down, timeout, model error, unusable model output) on the existing retry policy.

**Non-Goals:**

- Decoding or transcoding ICO/BMP (favicons are 16–32 px; even decoded they carry little vision signal).
- Changing the capture allowlist; ICO/BMP remain captured, browsable, and archivable.
- Classifying Ollama HTTP/model errors as permanent.
- A cross-task runtime verdict for corrupt-but-eligible media; preflight removes the known ineligibility class, and a corrupt eligible file costs two one-shot skips at most.
- Changing archive task behavior (`archive` rows never use `skipped`).

## Decisions

### D1. Eligibility is derived from real decoder capabilities, not a hardcoded list

`ThumbnailStorage` exposes the image MIME types its bundled decoder can read (`getDecodableImageMimeTypes()`), derived from `sharp.format` and mapped to MIME types. The `ai` package owns a pure predicate:

```
eligible(mime) = visionNative(mime)            // jpeg, png, webp, gif
              || thumbnailDecodable(mime)      // supplied by vfs; today includes tiff
              || mime.startsWith('video/')     // subject to runtime frame extraction
```

`visionNative` is exported by `ai`; `thumbnailDecodable` is injected by the app from `VFSAPI`, so `ai` stays free of `sharp`.

*Alternatives:* a hardcoded allowlist in `ai` (this is exactly how the current bug arose — the set drifts from the build); attempting a thumbnail at enqueue time (expensive, IO-bound, and still burns work).

### D2. Eligibility policy lives in the app; VFS stays generic

VFS gains only the mechanics: a `skipped` status, an atomic "record skipped" upsert, and SQL that accepts an `ineligibleMimeTypes` filter for retry/rescan. It never imports AI semantics. The app computes eligibility with the `ai` predicate and supplies decisions/filters. All enqueue entry points (ingest hook, `enqueueTask`, `enqueueClassification`, `requeueTask`, `requeueAll`, `retryFailedTasks`) funnel through one app-side helper.

*Alternative:* put eligibility in VFS. Rejected: the storage layer would encode vision-model semantics and would need to know the native vision set.

### D3. `skipped` is a first-class terminal status

- Not claimable (`claimTasks` already filters `status = 'pending'`).
- Carries the reason in the existing `error` column; `next_run_at` and `started_at` are cleared; `completed_at` stays NULL because skipping is not success.
- `attempts` is not incremented: nothing was retried.
- No schema migration — `status TEXT NOT NULL DEFAULT 'pending'` accepts the new value.
- `getQueueStatus()` currently ignores status names missing from its summary object, so `TaskStatusSummary` must gain `skipped`; `total` includes skipped rows.

*Alternatives:* keep `failed` and add an error-code column (requires migration and every surface learns the code); add a separate `unprocessable` status (two terminal non-success statuses with no behavioral difference).

### D4. No `pending` task may exist for ineligible media

Automatic ingest records both task types as `skipped` atomically (`recordSkippedTask`), so the UI can show the outcome instead of an unqueued gap. The upsert creates the row when missing and converts `pending`/`failed` rows to `skipped`; `completed` rows are preserved. Manual enqueue paths re-evaluate and return the skipped outcome with a reason rather than creating pending work.

This rule unifies A and B: whichever path the work arrives by, inapplicable media ends in exactly one terminal state and never occupies a scheduler slot.

### D5. Permanent errors are typed in `ai`

`ai` exports `UnprocessableMediaError` with a `reason` of `unsupported-format`, `no-representative-frame`, or `invalid-media`, plus a human-readable message. `OllamaClient.getRepresentativeImage` throws it (instead of a generic `Error`) when:

- the MIME type cannot produce a representative image, or
- video frame extraction yields nothing, or
- the media bytes are invalid for the decoder.

The scheduler classifies handler errors with `isUnprocessableMediaError()`. Everything else — Ollama unreachable, 60 s timeout, 404/400 model errors, empty or unparsable model output — stays transient and keeps the existing backoff policy.

*Alternatives:* infer permanence from message substrings (fragile); classify by media MIME in the scheduler (duplicates D1 and misses corrupt-but-eligible media).

### D6. Runtime skip path in the scheduler

In `runTask`'s failure branch:

- permanent → `updateTaskStatus({ status: 'skipped', error })`, emit `task:skipped` plus `classify:skipped`/`rename:skipped`, release the slot normally;
- transient → unchanged (`failed` with backoff, `task:retrying`/`task:failed`).

The permanent path runs before any Ollama call in the common case, so it costs one handler invocation and no network timeout.

### D7. Maintenance actions are eligibility-aware

- `retryFailedTasks({ taskType?, ineligibleMimeTypes })`: failed rows whose media is ineligible become `skipped`; the rest become `pending`.
- `requeueAll({ taskType?, ineligibleMimeTypes })` (full rescan): same split; ineligible rows are never reset to `pending`.
- `requeueTask(taskType, hash)`: the app evaluates eligibility first; ineligible hashes are recorded as skipped and the RPC returns `{ success: false, reason, error }` so the UI can explain.
- Eligibility is recomputed on every one of these paths, never read from a stored verdict. If a future build adds a decoder, a full rescan automatically promotes previously skipped files.

### D8. Startup reconciliation

After the database opens and before the scheduler starts, the app calls `api.skipIneligibleTasks({ ineligibleMimeTypes, error })`, a single SQL update joining `tasks` to `files` on `target_hash` for `status IN ('pending','failed')`. It logs the converted count. This clears pre-existing poison from the failed count and prevents old rows from being retried. Deterministic and idempotent.

*Alternative:* lazy conversion at first claim. Rejected: stale failed counts and retry buttons still resurrect rows.

### D9. UI semantics

- Queue summary: `pending, processing, completed, failed, skipped, total`.
- Progress percent = `(completed + skipped) / total`; skipped is settled work. `failed > 0` still forces `status="exception"`; skipped alone does not.
- Task console shows the skipped count and the per-row reason in the tooltip/detail surface.
- Session AI status gains `skipped`; counters gain `aiSkipped`; the Side Panel badge uses a distinct icon, not the failure icon.
- Older extension builds ignore unknown queue fields; `skipped` defaults to 0. A newer extension against an older app sees zeros.

### D10. Capture is untouched

The capture allowlist and the archive lane remain unchanged. ICO/BMP are still saved, shown in the library, and archived. This keeps the change narrowly about AI applicability and avoids losing user data for a pipeline limitation.

## Risks / Trade-offs

- **Eligibility false negatives** (a file the pipeline could handle is skipped) → derive the decoder set from the actual build, keep video eligible, and recompute on retry/rescan so a decoder upgrade plus rescan recovers files.
- **MIME mapping drift** between `sharp.format` keys and MIME types → unit test the mapping; unknown format ids are excluded (conservative) and logged once.
- **UI consumers assuming four statuses** → add `skipped` to the shared summary type and a test asserting `getQueueStatus` counts a skipped row in both `byType` and `total`; audit TaskConsole, Overview, SessionMetrics.
- **Version skew** (extension without skipped rendering) → skipped rows still add to `total` and are ignored elsewhere; surfaces remain functional, counts may look odd until both sides update.
- **Lost user intent** (someone wants to retry an ICO anyway) → recomputation on rescan/requeue means an upgrade path exists; the UI explains the reason instead of silently ignoring the action.
- **Backlog reconciliation cost** → one indexed update across `tasks` joined to `files`; negligible at current scale.

## Migration Plan

1. Ship app and extension together (they already share one release).
2. On first app start, reconciliation converts existing `pending`/`failed` rows for ineligible MIME types to `skipped`; the count is logged, and the next queue broadcast reflects it.
3. No database migration and no config change. Rollback: older builds ignore `skipped` rows (they are not claimable and not retried), so rollback is inert rather than destructive; redeploy restores full behavior.

## Open Questions

- Should `image/svg+xml` be eligible when it reaches the queue through a non-capture path? The rule says yes (the decoder can rasterize it), even though capture currently skips SVG. No action needed unless capture behavior changes.
- Missing blobs (`File not found`) remain transient per the existing rename spec; if they should become permanent, that belongs in a follow-up.
- Should the task console hide skipped rows behind a filter or show them inline with a "not applicable" badge? Implementation detail for the Options work; the spec requires the count and reason to be visible.
