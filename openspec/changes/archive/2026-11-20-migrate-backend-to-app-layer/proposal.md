## Why

The extension's MV3 service worker currently owns the AI task scheduler, the Ollama client, and configuration — headless logic that fights the SW's 30-second idle suspension via `alarms` wake-ups and `recoverStale`, and ships image bytes over the WebSocket to Ollama. This inflates the service worker, adds latency, and makes scheduling fragile. Moving that logic into a long-running Node backend while keeping the existing VFS storage contract makes scheduling reliable and the extension thin, without breaking the file-operation API.

## What Changes

- **Keep `vfs-service` as the storage + transport layer**, renamed conceptually to `vfs`. Its `VFSAPI` remains the stable file-operation contract; the WebSocket/HTTP servers stay as thin adapters over `VFSAPI`.
- **Add an `ai` package** that owns the Ollama integration (classify, rename, translate, health, model listing), moved out of the extension. It depends on `vfs`'s `VFSAPI` and reads blob/thumbnail bytes in-process instead of over the WebSocket.
- **Add an `app` package** as the composition root: it initializes `vfs` + `ai`, owns the scheduler runtime, the configuration store (source of truth), the event bus, and runs one long-lived process.
- **Own the event bus in `app`**: `vfs`, `ai`, and the scheduler emit into the app's bus, which pumps events through the `vfs` transport to the extension.
- **Decouple capture from classification**: the app auto-enqueues `classify` + `rename` on file ingest (`saveFile` / `POST /upload`).
- **Slim the extension to UX**: keep CDP capture, the offscreen video downloader, a thin WebSocket client that relays events, the config mirror, and the three UI surfaces.
- **Remove** the extension-side `ollama-client`, `tasks/engine`, `config-manager`, and `ollama-dnr`.
- **One-time config migration**: hand `vfsConfig` from `chrome.storage.local` to the app, persist it app-side, then demote storage to a mirror.
- Keep the existing WS + HTTP transport (no transport swap).

## Capabilities

### New Capabilities

- `app-task-scheduler`: The long-running Node scheduler runtime — claim loop, handler dispatch, concurrency, backoff, stale recovery, and paused intent.
- `app-config-store`: App-side configuration source of truth, the one-time migration from `chrome.storage.local`, and the extension config mirror.
- `app-event-bus`: The app-owned event aggregation point that pushes `vfs`/scheduler/`ai` events to the extension through the `vfs` transport.

### Modified Capabilities

- `vfs-service`: Becomes a storage library + transport consumed by the app; the `VFSAPI` file-operation contract stays compatible.
- `ollama-classifier`: The classifier runs in the `ai` package and reads media in-process via `VFSAPI` instead of the extension round-trip.
- `task-queue`: Scheduling ownership moves to the app; files are auto-enqueued on ingest; requeue/retry/clear/start/pause target the app.
- `extension-file-manager`: The extension shrinks to ingest-only; `file:captured` and task events originate in the app.
- `extension-options-config`: The options page reads/writes configuration and service status through the app rather than `chrome.storage.local`.
- `extension-classify-controls`: Start/pause/requeue/rescan controls target the app scheduler.
- `websocket-events`: The app becomes the origin of classify/task/file/tag events; the extension relays them to UI panels.

### Removed Capabilities

- `extension-ai-classify`: The extension no longer runs AI classification; that logic moves to the `ai` package.

## Impact

- **Packages**: add `packages/ai` (Ollama client + classification, in-process `VFSAPI` dependency) and `packages/app` (bootstrap, scheduler, config store, event bus); `packages/vfs-service` becomes the `vfs` library the app consumes. `packages/extension` background loses `classify/ollama-client.ts`, `tasks/engine.ts`, `background/config-manager.ts`, and `background/ollama-dnr.ts`.
- **Protocol**: the WS/HTTP transport is unchanged for file operations; new app RPC for config, scheduler control, and Ollama model/health; app-originated event frames replace extension-originated task events.
- **UI**: side panel and options largely unchanged (they keep the `chrome.runtime` event subscription model); options config handlers retarget from local storage to app RPC.
- **Dependencies**: none added; the `ai` package uses `fetch` to Ollama; the `app` package keeps `better-sqlite3`, `sharp`, `ffmpeg-static`, `ws`.
- **Config migration**: one-time hand-off from `chrome.storage.local` to the app; capture settings are pushed back to the extension mirror.
- **Docs/tests**: `ARCHITECTURE.md` rewritten for the vfs/ai/app/extension split; scheduler and Ollama behavior gain Node-side Vitest coverage.
