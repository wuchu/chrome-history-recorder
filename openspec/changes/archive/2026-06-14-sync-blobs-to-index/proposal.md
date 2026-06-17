## Why

Captured media blobs can exist in the current VFS workspace while their SQLite metadata rows are missing, which makes those files invisible to the extension UI and VFS list APIs. A manual sync action gives users a safe way to repair the index from the authoritative `workspace/blobs/` directory without reimporting external folders or overwriting existing metadata.

## What Changes

- Add a manual VFS blob-to-index sync operation that scans the current workspace `blobs/` directory and inserts missing SQLite `files` rows for supported image/video blobs.
- Preserve existing indexed media: if the computed content hash already exists in SQLite, the sync skips that blob and does not overwrite blob files, timestamps, tags, AI metadata, notes, starred state, or deletion state.
- Validate blob identity before indexing: files whose filename hash does not match their computed content hash are skipped.
- Add an Options page button for users to trigger the sync and receive a completion summary.
- Expose the sync through the existing Background runtime message and VFS WebSocket request path.
- Keep this as a manual one-shot repair action; it does not add filesystem watching or an external import directory.

## Capabilities

### New Capabilities
- `vfs-blob-index-sync`: Manual sync from the current VFS `workspace/blobs/` directory into the SQLite file metadata index.

### Modified Capabilities
- `extension-options-config`: Add an Options page control for triggering blob index sync and showing action feedback.
- `vfs-websocket-server`: Add a supported WebSocket API method for invoking the sync operation.

## Impact

- Affected VFS Service code: `packages/vfs-service/src/api.ts`, `dispatcher.ts`, blob/MIME helpers as needed, and VFS tests.
- Affected extension code: Background runtime message handling, `VFSWebSocketClient`, shared options runtime helpers, Options page hook/UI, and styling as needed.
- Affected specs: new blob sync behavior plus Options and WebSocket API contracts.
- No new runtime dependency is expected.
