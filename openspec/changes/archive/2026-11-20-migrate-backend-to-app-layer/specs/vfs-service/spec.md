## REMOVED Requirements

### Requirement: VFS Service exposes Native Messaging API

**Reason**: Native Messaging was already retired in favor of the WebSocket + HTTP transport; this requirement is stale.
**Migration**: None — the WebSocket and HTTP servers are the active transport and remain unchanged.

## MODIFIED Requirements

### Requirement: VFS Service provides file storage operations

The VFS Service SHALL provide atomic file save, read, delete, and list operations with content-addressable storage (hash-based blob files), consumable both in-process by the app and remotely by the extension.

#### Scenario: Save new file
- **WHEN** a caller invokes `saveFile` with buffer, mimeType, sourceUrl
- **THEN** VFS Service calculates SHA-256 hash (truncated to 16 chars), stores blob at `workspace/blobs/{hash}.{ext}`, inserts metadata into SQLite, and returns `{ hash, duplicate: false, size }`

#### Scenario: In-process consumption by the app
- **WHEN** the app's scheduler or AI package needs to read or update a file
- **THEN** it SHALL call the `VFSAPI` instance directly without traversing the WebSocket

#### Scenario: Save duplicate file
- **WHEN** a caller invokes `saveFile` with a buffer that already exists (same hash)
- **THEN** VFS Service returns `{ hash, duplicate: true, size }` without storing a duplicate blob

#### Scenario: Reject invalid video content
- **WHEN** a streamed video upload's bytes do not match the declared container signature
- **THEN** VFS Service rejects the upload without storing a blob or metadata row
- **AND** the temporary upload file is removed

#### Scenario: Get file by hash
- **WHEN** a caller invokes `getFile` with a valid hash
- **THEN** VFS Service returns `{ buffer: ArrayBuffer, mimeType, size, metadata }`

#### Scenario: Delete file (soft delete)
- **WHEN** a caller invokes `deleteFile` with a hash (no hard parameter)
- **THEN** VFS Service sets `is_deleted=1`, updates `deleted_at`, and returns `{ success: true }`

#### Scenario: Delete file (hard delete)
- **WHEN** a caller invokes `deleteFile` with a hash and `hard=true`
- **THEN** VFS Service removes the blob, deletes the SQLite record, and returns `{ success: true }`

### Requirement: VFS Service provides classification queue operations

The VFS Service SHALL provide typed task enqueue, status query, claim, and update operations for the classification and rename queues, consumed in-process by the app scheduler.

#### Scenario: Enqueue a typed task
- **WHEN** the app enqueues a task with a `task_type` and `target_hash`
- **THEN** VFS Service inserts a task row with `status='pending'`

#### Scenario: Claim next tasks
- **WHEN** the app scheduler claims due tasks
- **THEN** VFS Service atomically returns pending tasks and marks them `processing`

#### Scenario: Update task status
- **WHEN** the app scheduler completes or fails a task
- **THEN** VFS Service updates the task status, attempts, and error accordingly

## ADDED Requirements

### Requirement: VFS Service is a library consumed by the app

The VFS Service SHALL be consumable as a library whose `VFSAPI` instance is constructed by the app and shared with the transport and the app's scheduler and AI package.

#### Scenario: App constructs the API
- **WHEN** the app starts
- **THEN** it SHALL construct a single `VFSAPI` instance and hand it to the transport, scheduler, and AI package

#### Scenario: One process, one store
- **WHEN** the app runs
- **THEN** the scheduler, AI package, and transport SHALL share the same storage instance in a single process
