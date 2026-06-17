## Context

The project previously used Chrome Native Messaging to connect the extension to the local VFS Service. The `migrate-to-websocket` change replaced that transport with a WebSocket API on port 8765 and an HTTP API on port 8766, and the current source entrypoint starts those two servers directly.

Some repository assets still describe or validate the removed Native Messaging transport:

- Root installation scripts register a Chrome Native Messaging Host.
- The VFS Service package metadata still calls the package a Native Messaging Host.
- A manifest template remains under `packages/vfs-service/templates/`.
- `packages/vfs-service/test/native-messaging.test.ts` imports a deleted `src/native-messaging.js` module, causing the VFS Service test suite to fail.
- `ARCHITECTURE.md` still presents Native Messaging as the active architecture and references the old install scripts.

This cleanup should make active repository assets align with the current WebSocket + HTTP design without changing runtime behavior.

## Goals / Non-Goals

**Goals:**

- Remove active Native Messaging setup artifacts that are no longer part of the supported installation or development flow.
- Ensure VFS Service tests no longer import deleted Native Messaging modules.
- Preserve or replace useful API coverage currently located in stale tests with tests against supported abstractions or transports.
- Update package metadata and architecture documentation to describe WebSocket + HTTP accurately.
- Keep historical OpenSpec change records intact unless they are active source-of-truth documents for current behavior.

**Non-Goals:**

- Reintroducing Native Messaging as a fallback transport.
- Changing WebSocket or HTTP request/response behavior.
- Changing extension permissions beyond documentation consistency.
- Refactoring unrelated VFS storage, thumbnail, queue, or AI classification behavior.
- Cleaning archived or historical planning artifacts that intentionally document past design decisions.

## Decisions

### Decision 1: Remove root Native Messaging install scripts instead of repurposing them

The root `scripts/install-native-host.sh` and `scripts/install-native-host.ps1` only install Native Messaging Host manifests and registry entries. The current startup path is `pnpm --filter vfs-service start` or root development scripts that run the VFS Service as a WebSocket + HTTP server.

Alternative considered: keep the scripts with deprecation warnings. This would preserve a breadcrumb for old users, but it also keeps an unsupported setup path visible and increases the chance that users follow stale instructions.

### Decision 2: Delete the Native Messaging manifest template if no current code references it

The template `packages/vfs-service/templates/com.chromehistoryrecorder.vfs.json` is tied to Chrome Native Messaging registration. It should be removed after confirming no supported build or packaging flow references it.

Alternative considered: move it to documentation as historical reference. That is unnecessary because the migration proposal/design already records the old transport and why it was removed.

### Decision 3: Remove stale Native Messaging tests, but retain useful API coverage through current tests

`packages/vfs-service/test/native-messaging.test.ts` currently imports a deleted source module, so it cannot validate supported behavior. Any test cases that only validate response helpers or stdin/stdout framing should be deleted. Cases that exercise the dispatcher or VFS API should either be covered by existing `api.test.ts`, `integration.test.ts`, or moved to a transport-neutral dispatcher/WebSocket-focused test if coverage would otherwise be lost.

Alternative considered: recreate a compatibility shim for `native-messaging.js` just to satisfy tests. That would contradict the migration and make the removed transport appear supported.

### Decision 4: Treat `ARCHITECTURE.md` as current architecture documentation

`ARCHITECTURE.md` should be updated to describe the active WebSocket + HTTP dual-channel architecture, current component names such as `VFSWebSocketClient`, current endpoint responsibilities, and current risks such as service availability/port conflicts rather than Native Messaging registration.

Alternative considered: rename the current file as a legacy architecture document and create a new one. That creates two architecture documents and makes source-of-truth discovery harder for a small project.

### Decision 5: Do not edit historical OpenSpec records as part of this cleanup

OpenSpec changes such as `introduce-vfs-service` and `migrate-to-websocket` record historical decisions and migration context. Their Native Messaging references are expected history. The cleanup focuses on active code, tests, metadata, and docs that a developer would use today.

Alternative considered: globally remove all Native Messaging mentions from `openspec/changes`. That would erase historical context and make past decisions harder to understand.

## Risks / Trade-offs

- Removing scripts could surprise a user who still has a local Native Messaging setup → Mitigation: README already describes the current WebSocket + HTTP startup path; architecture docs should make the supported flow explicit.
- Deleting the stale test may reduce dispatcher/API coverage → Mitigation: compare the stale test cases against existing API/integration tests and move any uniquely valuable supported cases before deletion.
- Documentation rewrite could accidentally drift from implementation details → Mitigation: ground the rewrite in current source files such as `packages/vfs-service/src/index.ts`, `packages/vfs-service/src/websocket-server.ts`, `packages/vfs-service/src/http-server.ts`, and `packages/extension/src/background/vfs-ws-client.ts`.
- Some generated `dist/` files may still contain old Native Messaging outputs → Mitigation: do not hand-edit generated outputs; rely on `pnpm --filter vfs-service build` if generated artifacts are tracked and need refresh.

## Migration Plan

1. Confirm no supported package script, README command, or source file references root Native Messaging install scripts or the manifest template.
2. Remove obsolete Native Messaging install scripts and manifest template.
3. Remove or migrate stale Native Messaging tests while preserving supported dispatcher/API coverage.
4. Update VFS Service metadata and architecture documentation.
5. Run VFS Service tests using a non-watch command and, if generated outputs are tracked, rebuild the VFS Service.

Rollback is straightforward: restore deleted files and documentation from git if a still-supported flow is found to depend on them.

## Open Questions

- Should generated `packages/vfs-service/dist/` files be committed in this repository and refreshed during implementation, or are they treated as build output?
- Should `ARCHITECTURE.md` be fully rewritten in this change, or limited to targeted sections that mention Native Messaging?
