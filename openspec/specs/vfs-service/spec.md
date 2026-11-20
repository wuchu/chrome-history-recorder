# Spec: VFS Service

## Purpose

虚拟文件系统服务，提供原子化文件读写、SQLite 元数据管理，并作为库被 app 进程内共享使用

## Requirements


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

#### Scenario: Get non-existent file
- **WHEN** a caller invokes `getFile` with an invalid hash
- **THEN** VFS Service returns `{ error: 'File not found: <hash>' }`

#### Scenario: Delete file (soft delete)
- **WHEN** a caller invokes `deleteFile` with a hash (no hard parameter)
- **THEN** VFS Service sets `is_deleted=1`, updates `deleted_at`, and returns `{ success: true }`

#### Scenario: Delete file (hard delete)
- **WHEN** a caller invokes `deleteFile` with a hash and `hard=true`
- **THEN** VFS Service removes the blob, deletes the SQLite record, and returns `{ success: true }`

### Requirement: VFS Service provides metadata operations

The VFS Service SHALL provide metadata query and update operations for the SQLite index.

#### Scenario: List files with pagination
- **WHEN** Extension calls listFiles with { limit: 50, offset: 0, orderBy: 'capturedAt', order: 'desc' }
- **THEN** VFS Service returns { items: [...], total: <count>, hasMore: true/false }

#### Scenario: List files by category
- **WHEN** Extension calls listFiles with { category: 'cats' }
- **THEN** VFS Service returns items where category='cats' and is_deleted=0

#### Scenario: Update metadata
- **WHEN** Extension calls updateMetadata with hash and { category: 'dogs', aiFilename: 'cute_dog.jpg' }
- **THEN** VFS Service updates SQLite fields, sets updated_at timestamp, and returns { success: true, updatedMetadata }

#### Scenario: Get metadata
- **WHEN** Extension calls getMetadata with valid hash
- **THEN** VFS Service returns all metadata fields from SQLite

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

#### Scenario: Update task status
- **WHEN** the app scheduler completes or fails a task
- **THEN** VFS Service updates the task status, attempts, and error accordingly

### Requirement: VFS Service is a library consumed by the app

The VFS Service SHALL be consumable as a library whose `VFSAPI` instance is constructed by the app and shared with the transport and the app's scheduler and AI package.

#### Scenario: App constructs the API
- **WHEN** the app starts
- **THEN** it SHALL construct a single `VFSAPI` instance and hand it to the transport, scheduler, and AI package

#### Scenario: One process, one store
- **WHEN** the app runs
- **THEN** the scheduler, AI package, and transport SHALL share the same storage instance in a single process

### Requirement: VFS Service provides thumbnail generation

The VFS Service SHALL provide on-demand thumbnail generation for images and videos, caching results in workspace/thumbnails/.

#### Scenario: Get thumbnail for image
- **WHEN** Extension calls getThumbnail with hash and size='small' (100px)
- **THEN** VFS Service generates thumbnail if not cached, stores at thumbnails/{hash}-100.jpg, and returns { buffer, mimeType: 'image/jpeg' }

#### Scenario: Get thumbnail for video
- **WHEN** Extension calls getThumbnail with video hash
- **THEN** VFS Service extracts first frame (using ffmpeg), generates thumbnail, and returns { buffer, mimeType }

### Requirement: VFS Service manages workspace configuration

The VFS Service SHALL support workspace path configuration with default location at ~/.vfs-workspace.

#### Scenario: Initialize default workspace
- **WHEN** VFS Service starts without --workspace argument
- **THEN** VFS Service uses ~/.vfs-workspace as workspace path, creates directory structure if not exists

#### Scenario: Initialize custom workspace
- **WHEN** VFS Service starts with --workspace /custom/path
- **THEN** VFS Service uses /custom/path as workspace path

#### Scenario: Get workspace config
- **WHEN** Extension calls getWorkspaceConfig
- **THEN** VFS Service returns { path: '/Users/xxx/.vfs-workspace' }

### Requirement: VFS Service provides statistics API

The VFS Service SHALL provide file statistics including total count, size, and breakdown by category.

#### Scenario: Get stats
- **WHEN** Extension calls getStats
- **THEN** VFS Service returns { totalFiles, totalSize, byCategory: { cats: 10, dogs: 5, ... }, images, videos }

### Requirement: VFS Service provides tag counts API

The VFS Service SHALL provide tag usage counts including system tags and user tags.

#### Scenario: Get tag counts
- **WHEN** Extension calls getTagCounts
- **THEN** VFS Service returns { all: <total>, images: <count>, videos: <count>, starred: <count>, uncategorized: <count>, <user-tag>: <count>, ... }

### Requirement: VFS Service provides clear index API

The VFS Service SHALL provide API to clear the SQLite index (delete all records from files and classify_queue tables without deleting physical blobs).

#### Scenario: Clear index
- **WHEN** Extension calls clearIndex
- **THEN** VFS Service deletes all records from files and classify_queue tables in a transaction and returns { success: true }
