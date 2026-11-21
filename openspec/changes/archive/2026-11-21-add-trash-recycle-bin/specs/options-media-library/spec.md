## MODIFIED Requirements

### Requirement: Media management actions
The Media Library SHALL allow users to delete media into the trash and requeue AI work for a single item.

#### Scenario: Delete from detail view
- **WHEN** the user deletes the item shown in the detail view and confirms
- **THEN** the Media Library SHALL send a `trashFile` message to the Background
- **AND** the confirmation SHALL state that the item moves to the trash and can be restored
- **AND** upon success it SHALL close the detail view and remove the item from the grid

#### Scenario: Requeue classification
- **WHEN** the user requests classification again for an item
- **THEN** the Media Library SHALL requeue the `classify` task through the Background
- **AND** it SHALL show an error message if the requeue fails

#### Scenario: Requeue rename
- **WHEN** the user requests renaming again for an item
- **THEN** the Media Library SHALL requeue the `rename` task through the Background
- **AND** it SHALL show an error message if the requeue fails

### Requirement: Grid item quick delete
The Media Library SHALL provide a trash action on each media grid item.

#### Scenario: Show delete action on hover
- **WHEN** the user hovers over a media grid item
- **THEN** a delete button SHALL appear on that item

#### Scenario: Delete without opening detail
- **WHEN** the user clicks the grid item's delete button
- **THEN** the media detail view SHALL NOT open
- **AND** the Media Library SHALL ask for confirmation that the item moves to the trash

#### Scenario: Remove deleted item without scroll jump
- **WHEN** the user confirms deletion from the grid
- **THEN** the item SHALL be removed from the grid
- **AND** the scroll position SHALL remain stable

### Requirement: Live library updates
The Media Library SHALL update from Background events without requiring a full reload.

#### Scenario: Add newly captured media
- **WHEN** the Background relays a `file:captured` event
- **THEN** the Media Library SHALL add the item if it matches the active filter
- **AND** it SHALL deduplicate by hash

#### Scenario: Update AI metadata
- **WHEN** the Background relays a classification, rename, or task completion event for a visible item
- **THEN** the Media Library SHALL update that item's tags or display filename without reloading the list

#### Scenario: Remove trashed media
- **WHEN** the Background relays a `file:trashed` event
- **THEN** the Media Library SHALL remove the item from the grid
- **AND** it SHALL close the detail view if it was showing that item
- **AND** the scroll position SHALL remain stable

#### Scenario: Return restored media
- **WHEN** the Background relays a `file:restored` event
- **THEN** the Media Library SHALL make the restored item visible again if it matches the active filter
- **AND** it SHALL NOT require a full page reload
