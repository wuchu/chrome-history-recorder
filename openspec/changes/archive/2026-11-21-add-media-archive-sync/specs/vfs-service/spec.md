## ADDED Requirements

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
