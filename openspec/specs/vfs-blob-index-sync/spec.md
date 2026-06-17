# VFS Blob Index Sync

## Purpose

Provide a manual repair operation that synchronizes existing VFS workspace blob files into the SQLite metadata index without overwriting existing indexed media.

## Requirements

### Requirement: Manual blob index sync
The VFS Service SHALL provide a manual operation that synchronizes supported media blobs from the current workspace `blobs/` directory into the SQLite `files` metadata index.

#### Scenario: Index missing supported blob
- **WHEN** the sync operation scans a supported image or video blob in `workspace/blobs/`
- **AND** the blob content hash matches the filename hash
- **AND** SQLite does not contain a `files` row for that hash
- **THEN** the system SHALL insert a new `files` metadata row for the blob
- **AND** the inserted row SHALL use the blob extension, inferred MIME type, blob size, null source URL, uncategorized category, empty AI metadata, empty user metadata, and not-deleted state

#### Scenario: Use blob modification time for captured time
- **WHEN** the sync operation inserts a new metadata row for a blob
- **THEN** the row `captured_at` value SHALL be based on the blob file modification time

#### Scenario: Return sync summary
- **WHEN** the sync operation completes
- **THEN** the system SHALL return counts for scanned blobs, newly indexed blobs, existing hashes skipped, unsupported files skipped, invalid hash files skipped, and errors

### Requirement: Existing indexed blobs are never overwritten
The VFS Service SHALL preserve existing SQLite metadata and blob files when the sync operation encounters a hash that is already indexed.

#### Scenario: Skip existing hash
- **WHEN** the sync operation scans a blob whose computed content hash already exists in SQLite
- **THEN** the system SHALL skip the blob
- **AND** it SHALL NOT update the existing metadata row
- **AND** it SHALL NOT overwrite, rewrite, rename, or delete the blob file

#### Scenario: Preserve soft-deleted indexed hash
- **WHEN** the sync operation scans a blob whose hash exists in SQLite with `is_deleted = 1`
- **THEN** the system SHALL treat the hash as existing
- **AND** it SHALL NOT restore or modify the soft-deleted row

### Requirement: Blob identity validation
The VFS Service SHALL validate blob identity before inserting missing index rows.

#### Scenario: Skip filename hash mismatch
- **WHEN** the sync operation scans a blob file whose filename hash does not match the computed content hash
- **THEN** the system SHALL skip the file as invalid
- **AND** it SHALL NOT insert a SQLite metadata row for that file

#### Scenario: Skip unsupported extension
- **WHEN** the sync operation scans a file in `workspace/blobs/` whose extension does not map to a supported image or video MIME type
- **THEN** the system SHALL skip the file as unsupported
- **AND** it SHALL NOT insert a SQLite metadata row for that file

#### Scenario: Continue after per-file error
- **WHEN** the sync operation fails to read, stat, hash, or index an individual blob file
- **THEN** the system SHALL record the file error in the sync result
- **AND** it SHALL continue scanning remaining blob files

### Requirement: Manual sync is not directory watching
The blob index sync operation SHALL be a user-triggered one-shot repair action and SHALL NOT introduce filesystem watching.

#### Scenario: Sync does not watch for changes
- **WHEN** the sync operation finishes
- **THEN** the system SHALL NOT keep watching `workspace/blobs/` for future changes
- **AND** future blob changes SHALL require another explicit sync operation or existing capture flow behavior

#### Scenario: Sync does not enqueue classification automatically
- **WHEN** the sync operation inserts one or more missing metadata rows
- **THEN** the system SHALL NOT automatically add those hashes to the classification queue
