## MODIFIED Requirements

### Requirement: Side Panel media details
The Side Panel SHALL provide a focused VFS-backed media detail view from the media grid.

#### Scenario: Open media detail
- **WHEN** the user clicks a media thumbnail
- **THEN** the Side Panel SHALL open a focused media detail view
- **AND** image previews SHALL use the local VFS file URL derived from the media hash

#### Scenario: Show media detail title
- **WHEN** the Side Panel media detail view opens
- **THEN** it SHALL display a top-left title
- **AND** the title SHALL prefer the AI-renamed filename
- **AND** the title SHALL fall back to the media hash when no renamed filename exists

#### Scenario: Detail viewer actions
- **WHEN** the Side Panel media detail view is shown
- **THEN** it SHALL provide a close action
- **AND** it SHALL provide a delete action
- **AND** it SHALL NOT show download, rotate, or requeue-style toolbar icons in the focused original-image viewer

#### Scenario: Delete media from detail view
- **WHEN** the user clicks the delete button in the media detail view
- **THEN** the Side Panel SHALL show a confirmation dialog
- **AND** upon confirmation, the Side Panel SHALL send a `deleteFile` message to Background
- **AND** upon successful deletion, the media detail view SHALL close
- **AND** the deleted item SHALL be removed from the media grid

## ADDED Requirements

### Requirement: Media grid item delete button
The Side Panel SHALL provide a delete button on each media grid item for quick deletion.

#### Scenario: Delete button visibility on hover
- **WHEN** the user hovers over a media grid item
- **THEN** a delete button SHALL appear in the top-right corner of the item

#### Scenario: Delete button click prevents opening detail
- **WHEN** the user clicks the delete button on a media grid item
- **THEN** the media detail view SHALL NOT open
- **AND** the Side Panel SHALL show a confirmation dialog

#### Scenario: Delete media from grid
- **WHEN** the user confirms deletion from the grid item
- **THEN** the Side Panel SHALL send a `deleteFile` message to Background
- **AND** upon successful deletion, the deleted item SHALL be removed from the media grid

### Requirement: Handle file deletion events
The Side Panel SHALL listen for `file:deleted` events from Background and update the UI accordingly.

#### Scenario: Remove deleted item from grid
- **WHEN** the Side Panel receives a `file:deleted` event from Background
- **THEN** the deleted item SHALL be removed from the media grid
- **AND** the media detail view SHALL close if it was showing the deleted item
