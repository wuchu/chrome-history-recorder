# Tag Management

## Purpose

Provide a user-defined tag management interface in the Options page and persist tag definitions in Extension configuration.

## Requirements

### Requirement: Tag management UI
The system SHALL provide a tag management interface in the Options page.

#### Scenario: Display tag list
- **WHEN** user opens the Options page
- **THEN** the system SHALL display a list of user-defined tags
- **AND** each tag SHALL show its label (including emoji)
- **AND** each tag SHALL have edit, delete, and reorder controls

#### Scenario: Add new tag
- **WHEN** user clicks "Add Tag" button
- **THEN** the system SHALL open a dialog for tag creation
- **AND** user SHALL be able to input tag name and display label
- **AND** user SHALL be able to save the new tag

#### Scenario: Edit tag
- **WHEN** user clicks edit button on a tag
- **THEN** the system SHALL open a dialog for tag editing
- **AND** user SHALL be able to modify tag label
- **AND** user SHALL be able to save changes

#### Scenario: Delete tag
- **WHEN** user clicks delete button on a tag
- **THEN** the system SHALL show a confirmation dialog
- **AND** user SHALL be able to confirm deletion
- **AND** upon confirmation, the system SHALL remove the tag from the tag list
- **AND** the system SHALL NOT remove the tag from existing files (tags persist as free-form tags)

#### Scenario: Reorder tags
- **WHEN** user uses up/down buttons or drags tags
- **THEN** the system SHALL reorder the tags
- **AND** the new order SHALL be saved persistently

### Requirement: Tag persistence
The system SHALL persist user-defined tags in the extension configuration.

#### Scenario: Save tags to config
- **WHEN** user adds/edits/deletes/reorders tags
- **THEN** the system SHALL update the ExtensionConfig.userDefinedTags array
- **AND** the changes SHALL be persisted to chrome.storage

#### Scenario: Load tags from config
- **WHEN** Options page or DevTools Panel initializes
- **THEN** the system SHALL load tags from ExtensionConfig.userDefinedTags
- **AND** the system SHALL display tags in the saved order

### Requirement: Tag definition structure
The system SHALL define tags with structured metadata.

#### Scenario: Tag metadata fields
- **WHEN** a tag is defined
- **THEN** the tag SHALL have:
  - id: unique identifier
  - name: internal name (for filtering)
  - label: display name (may contain emoji)
  - isSystem: boolean indicating system tag
  - sortOrder: number for ordering
