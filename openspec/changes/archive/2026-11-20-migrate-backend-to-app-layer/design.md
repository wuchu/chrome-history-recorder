## Context

The extension's MV3 service worker holds the AI task scheduler (`tasks/engine.ts`), the Ollama client (`classify/ollama-client.ts`), and configuration (`config-manager.ts`). These are headless concerns that fight the SW's 30-second idle suspension — the background keeps itself alive with a one-minute `alarms` wake and `recoverStale`. Classification also ships image bytes from `vfs-service` to the extension to Ollama over the WebSocket, adding serialization and latency.

`vfs-service` already provides a clean in-process seam: `index.ts` constructs a `VFSAPI` instance and hands it to both the WebSocket and HTTP servers, whose dispatcher is a thin `method → api` mapping. The `tasks` table already lives in `vfs-service`; only the claim → handler → write-back loop lives in the extension.

## Goals / Non-Goals

**Goals:**

- Move the scheduler runtime, Ollama integration, and configuration into a long-running Node process.
- Keep the `vfs` storage contract and its WS/HTTP transport compatible with the extension.
- Introduce a clean three-package split: `vfs` (storage + transport), `ai` (Ollama), `app` (composition root).
- Let the scheduler and AI call `VFSAPI` in-process, removing the WS round-trip for task operations.
- Own the event bus in `app` and push events to the extension.
- Slim the extension to capture + UX.

**Non-Goals:**

- Changing the transport (keep WS + HTTP).
- Splitting further than three backend packages (e.g. separate `transport`/`scheduler` packages).
- Reintroducing Native Messaging.
- Turning `ai` into a separate process (it stays in-process, sharing the `VFSAPI` instance).

## Decisions

### 1. Three packages: `vfs`, `ai`, `app`

- `vfs` (`packages/vfs-service` renamed) keeps `VFSAPI`, SQLite, blob storage, thumbnails, and the WS/HTTP servers. Its file-operation API is unchanged.
- `ai` holds the Ollama client and classification/rename/translate logic. It depends on `vfs`'s `VFSAPI` interface.
- `app` is the composition root with the only `main`: it constructs `VFSAPI`, the `ai` client, the scheduler, and the config store; starts the transport; and runs the event bus.

Dependency direction is acyclic: `app → ai → vfs`, with `app` also depending on `vfs` directly for the scheduler and transport.

### 2. The scheduler and AI call `VFSAPI` in-process

The scheduler (`claimTasks` → run handler → `updateTypedTaskStatus` / `applyClassification`) and the AI client (`getThumbnail` / `getFile` / `applyClassification`) call `VFSAPI` methods directly. Task operations no longer traverse the WebSocket. The `app` passes the `VFSAPI` instance into both.

### 3. The event bus lives in `app`

`vfs` transport exposes an `emit` capability (or the app wraps the servers), but the bus is owned by `app`. The scheduler and AI publish task/classify events into the bus; `app` forwards them to the transport, which relays them to the extension over the WebSocket. The extension then rebroadcasts to UI panels via `chrome.runtime`.

### 4. Capture→classification decoupling

On file ingest (`saveFile` / `saveFileFromStream`), the app enqueues the paired `classify` + `rename` tasks idempotently. The extension no longer calls `enqueuePair`. Whether tasks actually run is governed by the app's `paused` intent.

### 5. Configuration source of truth moves to `app`

- `app` persists configuration (Ollama endpoint/model, language, prompt templates, concurrency, paused, capture settings) in the workspace (SQLite table or a JSON file).
- The extension holds a mirror; on connect and on change the app pushes capture-relevant settings to the extension.
- The options page reads/writes config and queries Ollama health/models through app RPC.
- One-time migration: on first run, the extension reads `vfsConfig` from `chrome.storage.local`, POSTs it to the app, the app persists it, and the extension marks migration done. On failure the app falls back to defaults and the failure is surfaced.

### 6. `ollama-dnr` removed

The app talks to Ollama directly with `fetch`, so the declarativeNetRequest rule that stripped the `Origin` header is no longer needed and is deleted.

## Risks / Trade-offs

- **Config migration is the brittle step** → single idempotent migration; the app is the source of truth after a successful hand-off, and a failed hand-off keeps defaults without silently losing user intent.
- **Two long-running things (app + browser)** → already the case; `vfs-service` was already a long-running process. No new process is added.
- **In-flight tasks during cutover** → pending tasks are in the app's `tasks` table, so they survive; the app's scheduler recovers `processing` rows on startup.
- **The extension still contains CDP + offscreen code** → these stay because they require browser-only capabilities (DevTools Protocol, browser network stack), not because they are business logic. The extension is "no business logic", not "tiny".
- **`ai` as a package is a modest split (~700 lines)** → justified by independent testability against a mocked Ollama endpoint; if it ever outgrows the process, the boundary is already drawn.
- **Event ordering across WS** → the bus serializes per-connection pushes; UI panels already tolerate out-of-order `capture:state` events.
- **Scheduler tests move to Node** → the claim/backoff/recover loop becomes directly testable against SQLite and a mocked Ollama HTTP, which is easier than in the SW.

## Migration Plan

1. Rename `vfs-service` → `vfs`, keep `VFSAPI` and transport intact (no behavior change).
2. Add the `ai` package; port `classify/ollama-client.ts` + `classify/base64.ts`, swapping the WS-backed media read for the in-process `VFSAPI`.
3. Add the `app` package: bootstrap, scheduler (port `tasks/engine.ts`), config store, event bus; wire `vfs` + `ai`.
4. Add app RPC for config/scheduler/Ollama; update `vfs` transport to emit the app's events.
5. Slim the extension: remove `ollama-client`, `tasks/engine`, `config-manager`, `ollama-dnr`; retarget options/sidepanel handlers to app RPC; keep CDP + offscreen + thin WS client.
6. Implement the one-time config migration.
7. Update `ARCHITECTURE.md`, package metadata, and the affected specs; add scheduler + `ai` Vitest coverage.

Rollback: the change is a controlled multi-step migration; until the extension is slimmed, both the old (extension-owned) and new (app-owned) paths can coexist behind feature-flagged app RPC.
