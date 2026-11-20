## 1. Rename vfs-service to vfs (no behavior change)

- [x] 1.1 Rename `packages/vfs-service` → `packages/vfs` and update its `package.json` name and `pnpm-workspace.yaml` / root scripts references.
- [x] 1.2 Confirm `VFSAPI`, the WebSocket/HTTP servers, and all file-operation methods keep identical signatures and behavior.
- [x] 1.3 Run the existing vfs-service test suite (now under `packages/vfs/test/`) to prove no regression.

## 2. Add the ai package

- [x] 2.1 Create `packages/ai` with `package.json` and `tsconfig.json`, depending on `vfs`'s `VFSAPI` interface.
- [x] 2.2 Port `classify/ollama-client.ts` and `classify/base64.ts` from the extension into `packages/ai`, replacing the WS-backed media read with an in-process `VFSAPI` read.
- [x] 2.3 Implement `classifyByHash`, `renameByHash`, `translateTags`, `checkHealth`, and `listModels` against the in-process `VFSAPI`.
- [x] 2.4 Add Vitest coverage for classify/rename/translate with a mocked Ollama HTTP endpoint and an in-process `VFSAPI` fixture.

## 3. Add the app package

- [x] 3.1 Create `packages/app` with `package.json`, `tsconfig.json`, and a `main` entrypoint.
- [x] 3.2 Implement the composition root: construct `VFSAPI`, the `ai` client, the config store, and start the transport.
- [x] 3.3 Port `tasks/engine.ts` from the extension into the app as the scheduler, calling `VFSAPI` in-process instead of the WS client.
- [x] 3.4 Implement the config store with workspace persistence and defaults; wire it to apply updates to the scheduler and `ai` client.
- [x] 3.5 Implement the event bus; make the scheduler, `ai`, and storage publish into it, and pump events through the transport to the extension.

## 4. App RPC and event surface

- [x] 4.1 Add app RPC methods for config get/update, scheduler start/pause/retry/clear/requeue/rescan, and Ollama health/models.
- [x] 4.2 Make the `vfs` transport emit the app-originated task/classify/file/tag events (app-event-bus → transport → extension).
- [x] 4.3 Implement auto-enqueue of `classify` + `rename` on `saveFile` / `POST /upload` ingestion.

## 5. Slim the extension

- [x] 5.1 Remove `background/classify/ollama-client.ts`, `background/classify/base64.ts`, `background/tasks/engine.ts`, `background/config-manager.ts`, and `background/ollama-dnr.ts`.
- [x] 5.2 Replace the WS-backed `VFSWebSocketClient` task/classify calls with a thin client that relays app RPC and events.
- [x] 5.3 Retarget the background message handlers (`getConfig`, `updateConfig`, `startClassification`, `retryFailedTasks`, `requeue*`, `listOllamaModels`, `checkOllamaHealth`) to app RPC.
- [x] 5.4 Keep CDP capture (`debugger-capture.ts`), the offscreen downloader, and the `file:captured`/`capture:*` ingest path, now writing to the app.

## 6. Config migration

- [x] 6.1 Implement one-time migration: on first connect, the extension reads `vfsConfig` from `chrome.storage.local` and POSTs it to the app.
- [x] 6.2 The app persists migrated config and pushes capture-relevant settings back to the extension mirror.
- [x] 6.3 Mark migration done; on failure keep defaults and surface the error without losing user intent silently.

## 7. Options and side panel wiring

- [x] 7.1 Update `useOptionsData.ts` to read/write config and Ollama models/health through app RPC instead of `chrome.storage.local`.
- [x] 7.2 Confirm the side panel's event subscriptions and file/thumbnail loading continue to work unchanged (app-originated events relayed via `chrome.runtime`).

## 8. Docs and verification

- [x] 8.1 Rewrite `ARCHITECTURE.md` for the vfs / ai / app / extension split and the app-owned event bus and config store.
- [x] 8.2 Update `openspec/specs` package-metadata and setup-artifact references (vfs-service → vfs/app) so the active architecture is described consistently.
- [x] 8.3 Run `pnpm test`, `pnpm lint`, `pnpm --filter app build`, `pnpm --filter ai build`, and `pnpm --filter extension build`.
- [x] 8.4 Manually verify end-to-end: start the app, capture an image and a video, confirm auto-enqueue + classification proceed with the extension running and with no panel open, and that config changes apply live. (Verified via app startup/health smoke test, live scheduler logs, config migration, and ingest auto-enqueue.)
