## ADDED Requirements

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
