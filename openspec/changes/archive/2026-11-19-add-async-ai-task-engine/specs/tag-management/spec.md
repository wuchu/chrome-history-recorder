## ADDED Requirements

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

### Requirement: Pin tags for tab visibility
The system SHALL allow users to pin tags so they remain visible in the Side Panel tab bar as the vocabulary grows.

#### Scenario: Pin a tag
- **WHEN** the user pins a tag
- **THEN** the system SHALL persist the pinned state and show that tag in the tab bar

#### Scenario: Unpin a tag
- **WHEN** the user unpins a tag
- **THEN** the tag SHALL follow the default top-usage visibility rule

### Requirement: Tag curation controls
The system SHALL provide controls to curate AI-generated tags.

#### Scenario: Rename a tag
- **WHEN** the user renames a tag
- **THEN** the system SHALL update its canonical name while preserving file associations and aliases

#### Scenario: Merge tags
- **WHEN** the user merges one tag into another
- **THEN** the system SHALL reassign files and aliases to the target tag
- **AND** it SHALL remove the merged tag

#### Scenario: Delete a tag
- **WHEN** the user deletes a tag
- **THEN** the system SHALL remove it from the vocabulary and from file tag lists

## MODIFIED Requirements

### Requirement: Tag management UI
The system SHALL provide a tag curation interface in the Options page for AI-owned tags.

#### Scenario: Display tag list
- **WHEN** the user opens the Options page
- **THEN** the system SHALL display tags from the VFS vocabulary with their usage counts and pinned state
- **AND** each tag SHALL have rename, merge, delete, and pin controls

#### Scenario: Legacy seed tags
- **WHEN** the system loads a legacy `userDefinedTags` configuration
- **THEN** it SHALL NOT use those entries as the content tag vocabulary source
- **AND** it SHALL optionally migrate them into pinned preferences or ignore them

### Requirement: Tag persistence
The system SHALL persist tag vocabulary and file associations through VFS Service storage.

#### Scenario: Save tags
- **WHEN** tags are created, updated, merged, deleted, or pinned
- **THEN** the system SHALL persist the changes in VFS Service storage

#### Scenario: Load tags
- **WHEN** the Options page or Side Panel initializes
- **THEN** the system SHALL load tags from the VFS vocabulary

### Requirement: Tag definition structure
The system SHALL define tags with structured metadata.

#### Scenario: Tag metadata fields
- **WHEN** a tag is defined
- **THEN** the tag SHALL have:
  - id: unique identifier
  - name: canonical name used for file association and filtering
  - label: display name (may contain emoji)
  - usage count
  - creator (`ai` or `user`)
  - pinned state
  - creation and update timestamps
