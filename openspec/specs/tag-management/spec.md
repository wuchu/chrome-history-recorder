# Tag Management

## Purpose

Provide an AI-owned tag vocabulary stored in VFS SQLite, with a curation interface in the Options page for renaming, merging, deleting, and pinning tags.
## Requirements
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

### Requirement: User-created tags

The tag vocabulary SHALL accept user-created tags alongside AI-created tags.

#### Scenario: Create a tag during assignment
- **WHEN** a user assigns a tag name that does not exist
- **THEN** the system SHALL create the tag with `created_by = 'user'`
- **AND** it SHALL normalize the name consistently with AI-created tags

#### Scenario: Reuse an AI tag
- **WHEN** the user assigns a name that already exists
- **THEN** the system SHALL reuse the existing tag
- **AND** it SHALL NOT create a duplicate entry

#### Scenario: System tag names are reserved
- **WHEN** user input uses a `system:` prefix or a reserved system tag name
- **THEN** the system SHALL reject the input
- **AND** it SHALL NOT create or assign that tag

#### Scenario: Vocabulary visibility
- **WHEN** a user-created tag is assigned to a file
- **THEN** the tag SHALL appear in the tag vocabulary and tag counts
- **AND** it SHALL be filterable like any other user tag

### Requirement: User tag assignment on a file

The system SHALL allow users to add and remove user tags on a single media item without discarding AI or system tags.

#### Scenario: Add a tag
- **WHEN** the user adds a tag to a file
- **THEN** the tag SHALL be appended if it is not already present
- **AND** existing AI tags, user tags, and `system:*` tags SHALL be preserved

#### Scenario: Remove a tag
- **WHEN** the user removes a user tag from a file
- **THEN** only that tag SHALL be removed
- **AND** `system:*` tags SHALL remain

#### Scenario: Duplicate assignment
- **WHEN** the user assigns a tag that the file already has
- **THEN** the file's tag list SHALL remain unchanged

#### Scenario: Usage counts
- **WHEN** a tag is added to or removed from a file
- **THEN** the tag's usage count SHALL be updated
- **AND** the tag count shown in the library SHALL reflect the change

#### Scenario: Search index
- **WHEN** a file's tags change
- **THEN** the file's searchable text SHALL include the new tags
- **AND** removed tags SHALL no longer match future searches
