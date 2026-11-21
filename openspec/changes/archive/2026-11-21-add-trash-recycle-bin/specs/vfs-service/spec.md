## MODIFIED Requirements

### Requirement: VFS Service provides file storage operations

The VFS Service SHALL provide atomic file save, read, trash, restore, and permanent delete operations with content-addressable storage (hash-based blob files), consumable both in-process by the app and remotely by the extension.

#### Scenario: Save new file
- **WHEN** a caller invokes `saveFile` with buffer, mimeType, sourceUrl
- **THEN** VFS Service calculates SHA-256 hash (truncated to 16 chars), stores blob at `workspace/blobs/{hash}.{ext}`, inserts metadata into SQLite, and returns `{ hash, duplicate: false, size }`

#### Scenario: In-process consumption by the app
- **WHEN** the app's scheduler or AI package needs to read or update a file
- **THEN** it SHALL call the `VFSAPI` instance directly without traversing the WebSocket

#### Scenario: Save duplicate file
- **WHEN** a caller invokes `saveFile` with a buffer whose hash matches an active file
- **THEN** VFS Service returns `{ hash, duplicate: true, size }` without storing a duplicate blob

#### Scenario: Restore a trashed duplicate
- **WHEN** a caller invokes `saveFile` with a buffer whose hash matches a file in the trash
- **THEN** VFS Service restores that file and returns `{ hash, duplicate: true, restored: true, size }`
- **AND** it SHALL NOT store a duplicate blob or metadata row

#### Scenario: Reject invalid video content
- **WHEN** a streamed video upload's bytes do not match the declared container signature
- **THEN** VFS Service rejects the upload without storing a blob or metadata row
- **AND** the temporary upload file is removed

#### Scenario: Get file by hash
- **WHEN** a caller invokes `getFile` with a valid hash
- **THEN** VFS Service returns `{ buffer: ArrayBuffer, mimeType, size, metadata }`
- **AND** trashed files SHALL remain readable so the trash view can preview them

#### Scenario: Get non-existent file
- **WHEN** a caller invokes `getFile` with an invalid hash
- **THEN** VFS Service returns `{ error: 'File not found: <hash>' }`

#### Scenario: Move file to trash
- **WHEN** a caller invokes `trashFile` with an existing hash
- **THEN** VFS Service sets `is_deleted=1`, updates `deleted_at`, keeps the blob and thumbnails, and returns `{ success: true }`

#### Scenario: Restore file from trash
- **WHEN** a caller invokes `restoreFile` with a trashed hash
- **THEN** VFS Service sets `is_deleted=0`, clears `deleted_at`, and returns `{ success: true }`

#### Scenario: Restore all trashed files
- **WHEN** a caller invokes `restoreAll`
- **THEN** VFS Service restores every trashed file and returns `{ success: true, count: <number> }`

#### Scenario: Permanently delete file
- **WHEN** a caller invokes `purgeFile` with an existing hash
- **THEN** VFS Service removes the blob, removes the thumbnails for that hash, deletes the tasks and SQLite record, and returns `{ success: true }`

#### Scenario: Permanently delete a missing file
- **WHEN** a caller invokes `purgeFile` with a hash that does not exist
- **THEN** VFS Service returns `{ success: true }` without error

#### Scenario: Empty the trash
- **WHEN** a caller invokes `emptyTrash`
- **THEN** VFS Service permanently deletes every trashed file and returns `{ success: true, count: <number> }`

### Requirement: VFS Service provides metadata operations

The VFS Service SHALL provide metadata query and update operations for the SQLite index.

#### Scenario: List files with pagination
- **WHEN** Extension calls listFiles with { limit: 50, offset: 0, orderBy: 'capturedAt', order: 'desc' }
- **THEN** VFS Service returns { items: [...], total: <count>, hasMore: true/false }

#### Scenario: List active files by default
- **WHEN** Extension calls listFiles without a `status` filter
- **THEN** VFS Service returns only files with `is_deleted = 0`

#### Scenario: List files by category
- **WHEN** Extension calls listFiles with { category: 'cats' }
- **THEN** VFS Service returns active items where category='cats'

#### Scenario: List trashed files
- **WHEN** Extension calls listFiles with { status: 'trashed' }
- **THEN** VFS Service returns only files with `is_deleted = 1`
- **AND** it SHALL default to ordering by `deleted_at` descending

#### Scenario: List all files
- **WHEN** Extension calls listFiles with { status: 'all' }
- **THEN** VFS Service returns both active and trashed files

#### Scenario: Update metadata
- **WHEN** Extension calls updateMetadata with hash and { category: 'dogs', aiFilename: 'cute_dog.jpg' }
- **THEN** VFS Service updates SQLite fields, sets updated_at timestamp, and returns { success: true, updatedMetadata }

#### Scenario: Get metadata
- **WHEN** Extension calls getMetadata with valid hash
- **THEN** VFS Service returns all metadata fields from SQLite, including `is_deleted` and `deleted_at`

### Requirement: VFS Service provides classification queue operations

The VFS Service SHALL provide typed task enqueue, status query, claim, and update operations for the classification and rename queues, consumed in-process by the app scheduler.

#### Scenario: Enqueue a typed task
- **WHEN** the app enqueues a task with a `task_type` and `target_hash`
- **THEN** VFS Service inserts a task row with `status='pending'`

#### Scenario: Get queue status
- **WHEN** the app queries queue status
- **THEN** VFS Service returns `{ pending: <count>, processing: <count>, completed: <count>, failed: <count> }`

#### Scenario: Claim next tasks
- **WHEN** the app scheduler claims due tasks
- **THEN** VFS Service atomically returns pending tasks and marks them `processing`
- **AND** it SHALL NOT claim tasks whose target file is in the trash

#### Scenario: Update task status
- **WHEN** the app scheduler completes or fails a task
- **THEN** VFS Service updates the task status, attempts, and error accordingly

#### Scenario: Purge removes tasks
- **WHEN** a file is permanently deleted
- **THEN** VFS Service deletes every task whose `target_hash` matches that file

### Requirement: VFS Service provides statistics API

The VFS Service SHALL provide file statistics including total count, size, breakdown by category, and trash totals.

#### Scenario: Get stats
- **WHEN** Extension calls getStats
- **THEN** VFS Service returns { totalFiles, totalSize, byCategory: { cats: 10, dogs: 5, ... }, images, videos, trashFiles, trashSize }
- **AND** totalFiles, totalSize, images, videos, and byCategory SHALL count only active files

#### Scenario: Get trash stats
- **WHEN** Extension calls getStats while files are in the trash
- **THEN** trashFiles SHALL count only files with `is_deleted = 1`
- **AND** trashSize SHALL be the sum of their blob sizes
