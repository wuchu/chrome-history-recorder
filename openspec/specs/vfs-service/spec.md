# Spec: VFS Service

## Purpose

虚拟文件系统服务，提供原子化文件读写、SQLite 元数据与标签管理、任务队列、搜索和游标分页能力，并作为库被 app 进程内共享使用。
## Requirements
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

The VFS Service SHALL resolve its workspace path from command-line arguments first, then the `VFS_WORKSPACE` environment variable, then the default location `~/.vfs-workspace`.

#### Scenario: Initialize default workspace
- **WHEN** VFS Service starts without `--workspace` / `-w` and without `VFS_WORKSPACE` set
- **THEN** VFS Service uses `~/.vfs-workspace` as the workspace path
- **AND** creates the directory structure if it does not exist

#### Scenario: Initialize custom workspace from CLI
- **WHEN** VFS Service starts with `--workspace /custom/path` or `-w /custom/path`
- **THEN** VFS Service uses `/custom/path` as the workspace path
- **AND** expands a leading `~` to the user's home directory

#### Scenario: Initialize custom workspace from environment
- **WHEN** VFS Service starts with `VFS_WORKSPACE=/custom/path` and no `--workspace` / `-w` argument
- **THEN** VFS Service uses `/custom/path` as the workspace path

#### Scenario: CLI overrides environment
- **WHEN** VFS Service starts with both `--workspace /cli/path` and `VFS_WORKSPACE=/env/path`
- **THEN** VFS Service uses `/cli/path` as the workspace path

#### Scenario: Get workspace config
- **WHEN** Extension calls `getWorkspaceConfig`
- **THEN** VFS Service returns an object whose `path` is the resolved workspace path

#### Scenario: Workspace is immutable for the VFS Service
- **WHEN** a caller invokes `setWorkspaceConfig` on the VFS Service
- **THEN** VFS Service rejects the request and reports that the workspace path cannot be changed after initialization

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

### Requirement: VFS Service provides tag counts API

The VFS Service SHALL provide tag usage counts including system tags and user tags. User tag counts SHALL be read from the vocabulary's maintained `usage_count` values rather than by scanning and parsing every file's tag list on each call.

#### Scenario: Get tag counts
- **WHEN** Extension calls getTagCounts
- **THEN** VFS Service returns { all: <total>, images: <count>, videos: <count>, starred: <count>, uncategorized: <count>, <user-tag>: <count>, ... }

#### Scenario: User tag counts come from the vocabulary
- **WHEN** getTagCounts is called
- **THEN** each user tag's count SHALL be read from `tags.usage_count`
- **AND** system counts SHALL be computed by a single aggregate query over active files
- **AND** the call SHALL NOT build a full grouping over `json_each(files.tags)`

#### Scenario: Tag lookup uses an index
- **WHEN** `getTagByName` resolves a tag name case-insensitively
- **THEN** the query SHALL use an index on `tags(name COLLATE NOCASE)`
- **AND** it SHALL NOT scan the full tags table

### Requirement: VFS Service provides clear index API

The VFS Service SHALL provide API to clear the SQLite index (delete all records from files and classify_queue tables without deleting physical blobs).

#### Scenario: Clear index
- **WHEN** Extension calls clearIndex
- **THEN** VFS Service deletes all records from files and classify_queue tables in a transaction and returns { success: true }

### Requirement: VFS Service provides incremental archive queries

The VFS Service SHALL provide a keyset-paginated query over the file index and a way to obtain a blob's absolute path without reading its contents.

#### Scenario: List files after a cursor
- **WHEN** a caller calls `listFilesCreatedAfter` with `{ createdAt: T, hash: H, limit: N }`
- **THEN** the VFS Service SHALL return at most `N` files with `is_deleted = 0`
- **AND** it SHALL order them by `created_at` ascending, then `hash` ascending
- **AND** it SHALL only include files whose `(created_at, hash)` is strictly greater than `(T, H)`

#### Scenario: Exclude deleted files
- **WHEN** a file has `is_deleted = 1`
- **THEN** the incremental query SHALL NOT return it

#### Scenario: Empty cursor start
- **WHEN** the caller supplies a cursor at the activation time with an empty hash
- **THEN** the query SHALL return files created at or after that instant in cursor order

#### Scenario: Get blob path
- **WHEN** a caller calls `getBlobPath` with a valid hash
- **THEN** the VFS Service SHALL return the blob's absolute path, size, and MIME type
- **AND** it SHALL NOT read the blob contents into memory

#### Scenario: Missing blob
- **WHEN** the hash has metadata but the blob file is absent
- **THEN** `getBlobPath` SHALL return `null`

#### Scenario: Index supports cursor queries
- **WHEN** the schema is initialized
- **THEN** it SHALL create an index on `files(created_at)` to support incremental queries

#### Scenario: Claim tasks by type
- **WHEN** a caller calls `claimTasks` with `limit` and a list of task types
- **THEN** the VFS Service SHALL only claim pending tasks whose `task_type` is in that list
- **AND** it SHALL leave other task types claimable by their own consumers

#### Scenario: Claim any type without a filter
- **WHEN** a caller calls `claimTasks` without task types
- **THEN** the VFS Service SHALL claim pending tasks of any type

### Requirement: VFS Service provides searchable media queries

The VFS Service SHALL expose a media query that supports free-text search, structured filters, multi-tag selection, and sorting while keeping the existing offset-based listing compatible.

#### Scenario: Free-text query
- **WHEN** `listFiles` receives a non-empty `q`
- **THEN** it SHALL match files whose AI filename, tags, source URL, or user notes contain the query text
- **AND** it SHALL combine the text match with every other active filter

#### Scenario: Structured filters
- **WHEN** `listFiles` receives `mimeType`, `sourceDomain`, `capturedFrom`, `capturedTo`, `starred`, or `classifyStatus`
- **THEN** it SHALL apply each provided filter
- **AND** omitted filters SHALL NOT constrain the result

#### Scenario: Multi-tag AND
- **WHEN** `listFiles` receives multiple `tags` with `tagMode = 'and'`
- **THEN** it SHALL return only files that contain every selected tag

#### Scenario: Multi-tag OR
- **WHEN** `listFiles` receives multiple `tags` with `tagMode = 'or'`
- **THEN** it SHALL return files that contain at least one selected tag

#### Scenario: System tags
- **WHEN** a selected tag is a system tag such as `image`, `video`, or `starred`
- **THEN** the query SHALL match both the plain and `system:`-prefixed storage form

#### Scenario: Source domains
- **WHEN** the client requests the list of source domains
- **THEN** the VFS Service SHALL return the distinct source hostnames present in the index
- **AND** the result SHALL be bounded by a caller-supplied limit

#### Scenario: Extended sort
- **WHEN** `listFiles` receives `orderBy` of `captured_at`, `size`, `confidence`, or `ai_filename`
- **THEN** it SHALL order by that field and use `hash` as a stable tiebreaker

### Requirement: VFS Service maintains a full-text index

The VFS Service SHALL maintain an FTS5 index for media search that survives existing-workspace upgrades.

#### Scenario: Index creation
- **WHEN** a workspace database is opened below the search schema version
- **THEN** the VFS Service SHALL create the search index and its synchronization triggers
- **AND** it SHALL backfill the index from existing `files` rows
- **AND** it SHALL record the new schema version

#### Scenario: Index maintenance
- **WHEN** a file row is inserted, updated, or deleted
- **THEN** the search index SHALL reflect the new AI filename, tags, source URL, and user notes

#### Scenario: Chinese and partial text
- **WHEN** the query is a partial Chinese phrase or filename substring
- **THEN** the search SHALL match substrings supported by the configured tokenizer
- **AND** queries shorter than the tokenizer minimum SHALL fall back to a substring comparison

#### Scenario: Index unavailable
- **WHEN** FTS5 is unavailable in the bundled SQLite build
- **THEN** the VFS Service SHALL still answer text queries through the substring fallback
- **AND** it SHALL record that the full-text index is degraded

### Requirement: VFS Service provides cursor pagination

The VFS Service SHALL provide stable cursor pagination for filtered media queries while retaining offset pagination for compatibility.

#### Scenario: First page with a cursor response
- **WHEN** `listFiles` is called without a cursor
- **THEN** it SHALL return the first page
- **AND** it SHALL return a `nextCursor` when more results exist

#### Scenario: Next page
- **WHEN** `listFiles` is called with a `nextCursor` from the same sort and filter
- **THEN** it SHALL return the next page without repeating rows already returned

#### Scenario: Stale cursor
- **WHEN** the cursor's sort or filter does not match the current query
- **THEN** the VFS Service SHALL reject or ignore the cursor and return the first page

#### Scenario: Offset compatibility
- **WHEN** a caller uses `offset` without a cursor
- **THEN** the existing offset behavior SHALL remain available

### Requirement: VFS Service validates query parameters

The VFS Service SHALL validate query parameters at the API boundary.

#### Scenario: Unknown sort field
- **WHEN** `orderBy` is not one of the supported fields
- **THEN** the VFS Service SHALL reject the query with a validation error
- **AND** it SHALL NOT interpolate the value into SQL

#### Scenario: Excessive page size
- **WHEN** `limit` exceeds the configured maximum
- **THEN** the VFS Service SHALL clamp it to the maximum

#### Scenario: Negative offset
- **WHEN** `offset` is negative or not finite
- **THEN** the VFS Service SHALL reject the query

### Requirement: VFS Service provides merge-safe metadata curation

The VFS Service SHALL provide transactional metadata operations for star, notes, and user tag changes that preserve system tags and concurrent AI metadata.

#### Scenario: Star update
- **WHEN** `setFileStarred` is called
- **THEN** the file's star state SHALL be updated
- **AND** the `system:starred` tag SHALL be added or removed consistently
- **AND** the update SHALL NOT drop other tags

#### Scenario: Notes update
- **WHEN** `updateFileNotes` is called
- **THEN** the notes SHALL be stored and the search index SHALL be updated

#### Scenario: Add tags
- **WHEN** `addFileTags` is called with one or more names
- **THEN** missing tags SHALL be added
- **AND** names SHALL be normalized
- **AND** `system:*` names SHALL be rejected from user input
- **AND** the tag vocabulary SHALL be updated with `created_by = 'user'` for new names

#### Scenario: Remove tags
- **WHEN** `removeFileTags` is called
- **THEN** only the named user tags SHALL be removed
- **AND** system tags SHALL remain

#### Scenario: Concurrent classification
- **WHEN** a curation operation races with an AI classification write
- **THEN** both writes SHALL run inside transactions
- **AND** the curation operation SHALL merge against the latest stored tag list rather than a stale snapshot

### Requirement: Tag usage counts are maintained incrementally

The VFS Service SHALL maintain each vocabulary tag's `usage_count` as the number of active files that currently carry that user tag, without scanning all files on every classification.

#### Scenario: Classification updates only changed tags
- **WHEN** `applyClassification` replaces a file's user tags
- **THEN** the VFS Service SHALL decrement `usage_count` for tags removed from that file
- **AND** it SHALL increment `usage_count` for tags added to that file
- **AND** it SHALL NOT rewrite usage counts for tags that did not change
- **AND** the update SHALL run inside the existing classification transaction

#### Scenario: Soft delete and restore adjust counts for one file
- **WHEN** an active file is moved to the trash
- **THEN** each of its user tags SHALL have `usage_count` decremented once
- **WHEN** a trashed file is restored
- **THEN** each of its user tags SHALL have `usage_count` incremented once

#### Scenario: Permanent delete adjusts counts only for active files
- **WHEN** an active file is permanently deleted
- **THEN** each of its user tags SHALL have `usage_count` decremented once
- **WHEN** an already-trashed file is permanently deleted
- **THEN** its usage counts SHALL NOT be changed again

#### Scenario: Repair recompute matches incremental state
- **WHEN** the full recompute routine is run after a sequence of incremental updates
- **THEN** the resulting `usage_count` values SHALL equal the values produced by the incremental path for the same file set

#### Scenario: Usage count never goes negative
- **WHEN** a decrement would take `usage_count` below zero
- **THEN** the stored value SHALL clamp to zero
