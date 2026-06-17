## 1. VFS Service Sync API

- [x] 1.1 Define a `SyncBlobsToIndexResult` shape with scanned, indexed, skipped existing, skipped unsupported, skipped invalid hash, and error counts/details.
- [x] 1.2 Implement `VFSAPI.syncBlobsToIndex()` to scan `BlobStorage.listBlobs()` results from the current workspace `blobs/` directory.
- [x] 1.3 For each candidate blob, infer MIME type from extension and skip unsupported non-image/non-video files.
- [x] 1.4 Read each supported blob, compute the existing truncated content hash, and skip files whose filename hash does not match content hash.
- [x] 1.5 Insert default SQLite metadata for missing hashes using blob size, extension, inferred MIME type, file mtime as `captured_at`, null source URL, uncategorized category, empty AI/user metadata, and not-deleted state.
- [x] 1.6 Skip all existing SQLite hashes without changing metadata, soft-delete state, queue records, or blob files.
- [x] 1.7 Record per-file read/stat/index errors and continue scanning remaining files.

## 2. WebSocket And Background Protocol

- [x] 2.1 Add `syncBlobsToIndex` to the VFS dispatcher method switch.
- [x] 2.2 Add a typed `syncBlobsToIndex()` method to the extension `VFSWebSocketClient`.
- [x] 2.3 Add a Background runtime message handler that invokes the VFS WebSocket sync method and returns the summary result.
- [x] 2.4 Add a shared Options/runtime helper and TypeScript result interface for requesting blob index sync.

## 3. Options Page UI

- [x] 3.1 Extend `useOptionsData()` with sync loading state and an action that calls the shared runtime helper.
- [x] 3.2 Add a dedicated media index maintenance card or section on the Options page with a single sync button.
- [x] 3.3 Show loading state while sync runs and success feedback with newly indexed and skipped existing counts.
- [x] 3.4 Show failure feedback and clear loading state if the sync request fails.

## 4. Tests And Verification

- [x] 4.1 Add VFS Service tests for indexing a missing supported blob from `blobs/`.
- [x] 4.2 Add VFS Service tests proving existing hashes, including soft-deleted rows, are skipped without metadata mutation.
- [x] 4.3 Add VFS Service tests for unsupported extensions, filename/content hash mismatches, and per-file errors where practical.
- [x] 4.4 Verify the dispatcher exposes `syncBlobsToIndex` through the WebSocket API path.
- [x] 4.5 Run targeted tests for `packages/vfs-service` and workspace lint/type checks relevant to touched files.
