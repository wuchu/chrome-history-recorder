# Spec: VFS Service

## Purpose

虚拟文件系统服务，提供原子化文件读写、SQLite 元数据管理、Native Messaging API

## Requirements


### Requirement: VFS Service exposes Native Messaging API

The VFS Service SHALL implement the Chrome Native Messaging protocol (stdin/stdout JSON with 4-byte length prefix) and expose a RPC-style API for file operations.

#### Scenario: Extension connects to VFS Service
- **WHEN** Extension calls chrome.runtime.sendNativeMessage('com.yourapp.vfs', { method: 'getWorkspaceConfig' })
- **THEN** VFS Service receives the message via stdin, processes it, and responds via stdout with JSON result

#### Scenario: VFS Service handles unknown method
- **WHEN** Extension calls an unknown method
- **THEN** VFS Service responds with { error: 'Unknown method: <method_name>' }

### Requirement: VFS Service provides file storage operations

The VFS Service SHALL provide atomic file save, read, delete, and list operations with content-addressable storage (hash-based blob files).

#### Scenario: Save new file
- **WHEN** Extension calls saveFile with buffer, mimeType, sourceUrl
- **THEN** VFS Service calculates SHA-256 hash (truncated to 16 chars), stores blob at workspace/blobs/{hash}.{ext}, inserts metadata into SQLite, and returns { hash, duplicate: false, size }

#### Scenario: Save duplicate file
- **WHEN** Extension calls saveFile with buffer that already exists (same hash)
- **THEN** VFS Service returns { hash, duplicate: true, size } without storing duplicate blob

#### Scenario: Get file by hash
- **WHEN** Extension calls getFile with valid hash
- **THEN** VFS Service returns { buffer: ArrayBuffer, mimeType, size, metadata }

#### Scenario: Get non-existent file
- **WHEN** Extension calls getFile with invalid hash
- **THEN** VFS Service returns { error: 'File not found: <hash>' }

#### Scenario: Delete file (soft delete)
- **WHEN** Extension calls deleteFile with hash (no hard parameter)
- **THEN** VFS Service sets is_deleted=1 in SQLite, updates deleted_at timestamp, and returns { success: true }

#### Scenario: Delete file (hard delete)
- **WHEN** Extension calls deleteFile with hash and hard=true
- **THEN** VFS Service removes blob file, deletes SQLite record, and returns { success: true }

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

The VFS Service SHALL provide enqueue, status query, and dequeue operations for the classification task queue.

#### Scenario: Enqueue classification task
- **WHEN** Extension calls enqueueClassification with hash
- **THEN** VFS Service inserts record into classify_queue table with status='pending', priority=5

#### Scenario: Get queue status
- **WHEN** Extension calls getQueueStatus
- **THEN** VFS Service returns { pending: <count>, processing: <count>, completed: <count>, failed: <count> }

#### Scenario: Mark task as processing
- **WHEN** Extension calls updateTaskStatus with hash and status='processing'
- **THEN** VFS Service updates classify_queue.status and sets started_at timestamp

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
