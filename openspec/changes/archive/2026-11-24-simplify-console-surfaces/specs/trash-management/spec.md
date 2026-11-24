## MODIFIED Requirements

### Requirement: Trash listing and statistics

The system SHALL expose trashed files for the Options media library's trash view.

#### Scenario: List trashed files
- **WHEN** a caller invokes `listFiles` with `status = 'trashed'`
- **THEN** the system SHALL return only trashed files
- **AND** it SHALL order them by `deleted_at` descending by default
- **AND** pagination and `hasMore` SHALL behave like the active listing

#### Scenario: List all files
- **WHEN** a caller invokes `listFiles` with `status = 'all'`
- **THEN** the system SHALL return both active and trashed files
- **AND** the default when `status` is omitted SHALL be `active`

#### Scenario: Trash statistics
- **WHEN** a caller invokes `getStats`
- **THEN** the result SHALL include the trashed file count and trashed storage size separately from active totals
- **AND** the Options media library SHALL use those values for its trash view count and storage summary

### Requirement: Selected-item restore and purge

The trash view SHALL support restoring or permanently deleting a selected subset of trashed items.

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
- **WHEN** the trash view shows its global actions
- **THEN** restore-all and empty-trash SHALL remain available
- **AND** they SHALL apply to the whole trash

#### Scenario: Selection clears on action
- **WHEN** a selected restore or purge completes
- **THEN** the selection SHALL be cleared

## ADDED Requirements

### Requirement: Trash surface placement

The trash capability SHALL be exposed through the Options media library's trash view rather than a standalone console page, while preserving every lifecycle operation.

#### Scenario: Trash operations are reachable from the library
- **WHEN** the user opens the media library's trash view
- **THEN** the user SHALL be able to list, restore, permanently delete, restore all, and empty the trash
- **AND** no lifecycle operation SHALL require a separate Trash navigation section

#### Scenario: Trash count is visible before opening the view
- **WHEN** the media library renders its view switch
- **THEN** the trash item count SHALL be visible without opening the trash view
- **AND** the count SHALL update after trash, restore, purge, and empty-trash operations

#### Scenario: Lifecycle events update the view
- **WHEN** a trashed item is restored or permanently deleted from any surface
- **THEN** the trash view SHALL refresh and SHALL NOT show stale items
