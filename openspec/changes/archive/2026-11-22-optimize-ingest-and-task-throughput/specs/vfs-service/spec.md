## ADDED Requirements

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

## MODIFIED Requirements

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
