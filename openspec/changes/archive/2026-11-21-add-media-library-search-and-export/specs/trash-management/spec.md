## ADDED Requirements

### Requirement: Batch trash operations

The media library SHALL move a multi-item selection to the trash in one user action.

#### Scenario: Trash a selection
- **WHEN** the user confirms trashing a multi-item selection
- **THEN** the system SHALL move each selected item to the trash
- **AND** it SHALL remove successfully trashed items from the media grid

#### Scenario: Batch confirmation
- **WHEN** the user requests batch trash
- **THEN** the confirmation SHALL state how many items will move to the trash
- **AND** it SHALL state that they can be restored later

#### Scenario: Partial failure
- **WHEN** some items in the batch cannot be trashed
- **THEN** the system SHALL keep those items in the grid
- **AND** it SHALL report the number of failures and their reasons

#### Scenario: Empty selection
- **WHEN** the user requests batch trash with no selected items
- **THEN** the system SHALL NOT call the trash operation

### Requirement: Selected-item restore and purge

The trash page SHALL support restoring or permanently deleting a selected subset of trashed items.

#### Scenario: Restore selection
- **WHEN** the user selects trashed items and chooses restore
- **THEN** each selected item SHALL be restored
- **AND** successfully restored items SHALL leave the trash list
- **AND** failures SHALL be reported

#### Scenario: Purge selection
- **WHEN** the user selects trashed items and chooses permanent delete
- **THEN** the confirmation SHALL state that the action cannot be undone
- **AND** each selected item, its blob, thumbnails, and archived copy SHALL be removed
- **AND** failures SHALL be reported

#### Scenario: Global actions remain
- **WHEN** the trash page shows its global actions
- **THEN** restore-all and empty-trash SHALL remain available
- **AND** they SHALL apply to the whole trash

#### Scenario: Selection clears on action
- **WHEN** a selected restore or purge completes
- **THEN** the selection SHALL be cleared
- **AND** the trash list SHALL be refreshed
