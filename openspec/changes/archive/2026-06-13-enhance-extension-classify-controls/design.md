## Context

The current implementation uses VFS Service as the local storage/queue engine and the Extension Background Service Worker as the AI workflow coordinator. Background owns the `OllamaClient`, `ClassifyScheduler`, VFS WebSocket client, and configuration manager. DevTools Panel is the UI layer and communicates with Background through `chrome.runtime.sendMessage` and broadcast events.

The migration away from Proxy Plugin mode left two important gaps:

1. AI classification is already available, but it starts automatically and exposes little user control.
2. Configuration exists in Background, but the DevTools UI does not yet expose Ollama model discovery/selection or queue controls.

This change keeps the current Extension Background + VFS architecture. It does not revive the old Proxy Plugin architecture.

## Goals / Non-Goals

**Goals:**

- Let users query the configured local Ollama endpoint and select an installed model from the DevTools UI.
- Let users start and pause classification processing manually.
- Let users requeue a specific media item for classification and AI filename regeneration.
- Surface retry failed and clear queue actions in the classification progress UI.
- Keep queue and task status visible through Background events and periodic refresh.
- Preserve user metadata while allowing AI-owned fields to be overwritten during reprocessing.

**Non-Goals:**

- Do not physically rename, move, export, or organize blob files on disk.
- Do not reintroduce Proxy Plugin mode or Proxy HTTP endpoints for classification.
- Do not support remote Ollama discovery beyond the configured endpoint.
- Do not implement multi-model routing by MIME type beyond selecting one vision model for the current AI image/video-frame flow.
- Do not add authentication or external network service dependencies.

## Decisions

### Decision 1: Treat rename as AI filename metadata update

**Choice:** For this change, "rename" means regenerating/updating `files.ai_filename` and related AI-owned metadata, not renaming blob files.

**Rationale:** VFS stores media as hash-addressed blobs. The browser extension cannot safely manipulate arbitrary local filesystem paths, and physical organization introduces collision, rollback, and cross-platform filename concerns. Metadata-only rename matches the current `classifyByHash` flow and keeps file storage immutable.

**Alternatives considered:**

- Physical rename in Extension: rejected because Extension lacks direct local filesystem access.
- Physical rename/export in VFS Service: viable as a later change, but out of scope because it needs a separate export/organize API and conflict policy.

### Decision 2: Add model discovery to Background OllamaClient

**Choice:** Add a Background-level model listing operation that calls `GET {ollamaEndpoint}/api/tags`, normalizes the returned model names, and returns them to DevTools.

**Rationale:** Background already owns Ollama endpoint configuration and health checks, so it is the right place to centralize endpoint access, DNR/CORS handling, timeout behavior, and error reporting. DevTools remains a UI layer.

**Alternatives considered:**

- DevTools fetches Ollama directly: simpler initially, but duplicates endpoint handling and bypasses Background config/state.
- Hard-coded model list: poor user experience and does not reflect installed local models.

### Decision 3: Scheduler pause stops claiming new work but lets active tasks finish

**Choice:** Pause will stop future `getPendingTasks`/task claiming, while tasks already in `processing` are allowed to complete or fail normally.

**Rationale:** Ollama calls are not safely cancellable once in flight without adding abort propagation and partial task recovery. Letting active tasks finish avoids leaving queue rows stuck in `processing` and makes pause predictable.

**Alternatives considered:**

- Hard cancellation: more responsive, but requires AbortController plumbing and task recovery rules.
- Stop service entirely: too broad; users only need AI queue control.

### Decision 4: Keep automatic capture enqueue, but make processing user-controllable

**Choice:** Captured media can continue to be enqueued automatically, but whether pending work is processed depends on scheduler running/paused state.

**Rationale:** Capture and classification are separate user intents. Automatic enqueue preserves the current pipeline and avoids missed work; manual start/pause gives users control over Ollama load and timing.

**Alternatives considered:**

- Disable auto-enqueue when paused: would require scanning for missed items later and makes pause semantics ambiguous.
- Add a global "manual enqueue only" mode: useful later, but not required for this change.

### Decision 5: Use requeue as the per-media quick action primitive

**Choice:** A media quick action sends a `requeueClassification`/`enqueueClassification` message with high priority and optional reset semantics.

**Rationale:** VFS already has persistent queue storage and unique rows by hash. Requeueing through the same queue keeps behavior consistent with normal classification, retries, and status UI.

**Alternatives considered:**

- Directly classify immediately from the quick action: bypasses queue controls and makes pause semantics confusing.
- Separate rename queue: not needed while rename is metadata generated by the same Ollama prompt.

### Decision 6: Broadcast task status events from Scheduler

**Choice:** Scheduler should emit status events for task start, completion, failure, queue updates, and scheduler control changes.

**Rationale:** DevTools already consumes Background events for realtime updates, but current events are incomplete. Consistent events reduce reliance on polling and keep cards/progress in sync.

**Alternatives considered:**

- Poll only: simpler but slower and less responsive.
- VFS-only events: useful for queue table changes, but Background owns AI scheduler state and Ollama outcomes.

## Risks / Trade-offs

- **Ollama model list may include non-vision models** → Show all installed models initially, prefer current configured model, and optionally label the UI with guidance that selected models must support image input.
- **Pause does not stop active tasks immediately** → Document UI state as "pausing" or "paused after active tasks finish" if processing count is non-zero.
- **Requeue overwrites previous AI metadata** → Preserve user-owned fields (`is_starred`, `user_notes`) and only overwrite AI-owned fields (`category`, `ai_filename`, `tags`, `confidence`, `classified_at`, `model_used`).
- **Queue rows may lose history if implemented with INSERT OR REPLACE** → Prefer explicit reset/update semantics for existing queue rows when practical; otherwise document requeue as resetting task history.
- **Service worker lifecycle can reset in-memory scheduler state** → Persist user preference such as `classificationAutoStart` or `schedulerPaused` in `chrome.storage.local` and reapply it during Background initialization.
- **UI can become stale when service restarts** → Keep existing periodic queue/status refresh as a fallback to broadcast events.

## Migration Plan

1. Add Background message handlers and client methods without changing existing message names.
2. Extend Scheduler state and events while preserving current automatic enqueue behavior.
3. Add DevTools controls and quick actions behind the new message handlers.
4. Update specs/docs to clarify that rename means AI filename metadata in this change.
5. Validate with VFS connected/disconnected, Ollama unavailable, empty model list, running queue, paused queue, failed queue, and per-item requeue scenarios.

Rollback is straightforward: remove the new UI controls/messages and keep existing automatic classification behavior. Existing VFS data remains compatible because the change does not alter file storage or require destructive migrations.

## Open Questions

- Should the default startup behavior remain automatic processing, or should first-run default be paused until the user clicks start?
- Should requeue reset `category`/`ai_filename` immediately to a pending visual state, or keep old AI metadata visible until the new result arrives?
- Should model discovery filter likely vision models or show all Ollama models with a warning?
- Should queue clear remove all rows or only terminal rows (`completed`/`failed`) from the UI action?