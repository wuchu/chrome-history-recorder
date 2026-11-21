## ADDED Requirements

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
