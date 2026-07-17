## MODIFIED Requirements

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
- **AND** the scroll position SHALL remain stable

### Requirement: Handle file deletion events
The Side Panel SHALL listen for `file:deleted` events from Background and update the UI accordingly.

#### Scenario: Remove deleted item from grid
- **WHEN** the Side Panel receives a `file:deleted` event from Background
- **THEN** the deleted item SHALL be removed from the media grid
- **AND** the media detail view SHALL close if it was showing the deleted item
- **AND** the scroll position SHALL NOT jump

## ADDED Requirements

### Requirement: Stable scroll position during deletion
The Side Panel SHALL maintain scroll position stability when media items are deleted.

#### Scenario: Delete without full refresh
- **WHEN** the user deletes a media item from the grid or detail view
- **THEN** the Side Panel SHALL NOT trigger a full refresh of historical images
- **AND** the Side Panel SHALL rely on `file:deleted` events to update the UI
- **AND** the scroll position SHALL remain unchanged

#### Scenario: Scroll stability with masonry layout
- **WHEN** an item is removed from the masonry grid
- **THEN** the grid SHALL reflow smoothly
- **AND** the user's current scroll position SHALL be preserved
