## ADDED Requirements

### Requirement: Manual star toggle

The system SHALL let users mark any media item as starred or unstarred.

#### Scenario: Star an item
- **WHEN** the user stars a media item
- **THEN** the file's `is_starred` state SHALL be persisted
- **AND** the `system:starred` tag SHALL be added

#### Scenario: Unstar an item
- **WHEN** the user unstars a media item
- **THEN** the file's `is_starred` state SHALL be cleared
- **AND** the `system:starred` tag SHALL be removed
- **AND** other tags SHALL be preserved

#### Scenario: Star control is visible
- **WHEN** the user views an item in the grid or detail view
- **THEN** the item's current star state SHALL be visible
- **AND** the user SHALL be able to toggle it from the detail view

#### Scenario: Live update
- **WHEN** a file is starred or unstarred
- **THEN** the visible grid item and the detail view SHALL reflect the new state
- **AND** the starred filter result SHALL update without a full reload

#### Scenario: Starred tab
- **WHEN** the user opens the starred tag tab after starring an item
- **THEN** that item SHALL appear in the result
- **AND** unstarred items SHALL NOT appear

#### Scenario: System tag immutability
- **WHEN** the user views tag management
- **THEN** the starred system tag SHALL remain read-only
- **AND** the user SHALL NOT be able to rename, merge, or delete it
