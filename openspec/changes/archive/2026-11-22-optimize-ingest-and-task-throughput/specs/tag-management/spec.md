## MODIFIED Requirements

### Requirement: AI-owned tag vocabulary storage
The system SHALL store content tags in the VFS SQLite tag vocabulary rather than in extension configuration.

#### Scenario: Persist vocabulary entries
- **WHEN** a tag is created or used
- **THEN** the system SHALL persist it in the VFS `tags` table with name, usage count, creator, and pin state

#### Scenario: Persist aliases
- **WHEN** Ollama maps a candidate tag to a canonical tag
- **THEN** the system SHALL persist the mapping in the `tag_aliases` table

#### Scenario: Keep file tag cache
- **WHEN** a file's tags are updated
- **THEN** the system SHALL update the canonical tag names in the file's tag list
- **AND** it SHALL preserve `system:*` tags

#### Scenario: Classification updates usage counts incrementally
- **WHEN** a classification replaces a file's user tags
- **THEN** the vocabulary SHALL decrement usage counts for tags removed from that file
- **AND** it SHALL increment usage counts for tags added to that file
- **AND** it SHALL NOT recompute usage counts for every file in the library

#### Scenario: Trash state is reflected in usage counts
- **WHEN** a file is moved to the trash, restored, or permanently deleted
- **THEN** its user tags' usage counts SHALL change by exactly one per tag
- **AND** permanently deleting an already-trashed file SHALL NOT decrement them again

#### Scenario: Curation operations may rebuild counts
- **WHEN** a tag is renamed, merged, or deleted
- **THEN** the system MAY recompute usage counts once to keep the vocabulary consistent
- **AND** the resulting counts SHALL match the file tag lists
