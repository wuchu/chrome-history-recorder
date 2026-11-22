## MODIFIED Requirements

### Requirement: VFS Service provides searchable media queries

The VFS Service SHALL expose a media query that supports free-text terms, structured filters, multi-tag selection, and sorting while keeping the existing offset-based listing compatible.

#### Scenario: Single free-text term
- **WHEN** `listFiles` receives a non-empty `q`
- **THEN** it SHALL match files whose AI filename, tags, source URL/domain, or user notes contain the query text
- **AND** it SHALL combine the text match with every other active filter

#### Scenario: Multiple terms
- **WHEN** `listFiles` receives `terms` with two or more entries
- **THEN** a file SHALL match only if every term matches at least one searchable field
- **AND** different terms MAY match different fields

#### Scenario: Phrase term
- **WHEN** a term contains spaces
- **THEN** it SHALL match as a contiguous substring across a searchable field

#### Scenario: Excluded terms
- **WHEN** `listFiles` receives `excludeTerms`
- **THEN** files matching any excluded term SHALL be removed from the result
- **AND** the exclusion SHALL combine with all positive terms and filters

#### Scenario: Terms with structured filters
- **WHEN** `listFiles` receives both terms and structured filters
- **THEN** the term match and every provided filter SHALL all apply

#### Scenario: Empty terms
- **WHEN** `terms` is omitted or empty
- **THEN** no term constraint SHALL be applied
- **AND** a provided `q` SHALL still be treated as one term

#### Scenario: q with terms
- **WHEN** `listFiles` receives both `q` and `terms`
- **THEN** `q` SHALL be treated as an additional positive term

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

#### Scenario: Tag groups
- **WHEN** `listFiles` receives `tagGroups` with one or more groups
- **THEN** values inside each group SHALL be matched with OR
- **AND** the groups SHALL be combined with AND

#### Scenario: Multiple source domains
- **WHEN** `listFiles` receives `sourceDomains` with one or more entries
- **THEN** it SHALL return files whose source domain matches any entry

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
- **THEN** the search index SHALL reflect the new AI filename, tags, source URL, source domain, and user notes

#### Scenario: Schema upgrade
- **WHEN** an existing workspace is opened with an older search schema version
- **THEN** the VFS Service SHALL rebuild the search index transactionally
- **AND** the rebuild SHALL include the normalized source domain in the searchable text

#### Scenario: Chinese and partial text
- **WHEN** the query is a partial Chinese phrase or filename substring
- **THEN** the search SHALL match substrings supported by the configured tokenizer
- **AND** queries shorter than the tokenizer minimum SHALL fall back to a substring comparison

#### Scenario: Index unavailable
- **WHEN** FTS5 is unavailable in the bundled SQLite build
- **THEN** the VFS Service SHALL still answer text queries through the substring fallback
- **AND** the fallback SHALL include the normalized source domain in the searchable text
- **AND** it SHALL record that the full-text index is degraded
