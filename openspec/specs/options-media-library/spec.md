# Options Media Library

## Purpose

Provide the global media library in the Options console, including browsing, tag filtering, media details, deletion, and AI requeue.

## Requirements

### Requirement: Global media library
The Options Media Library SHALL provide the global VFS-backed media library for all captured files.

#### Scenario: Load global media
- **WHEN** the Media Library tab opens
- **THEN** it SHALL request global media from the Background using the existing `listFiles` message protocol
- **AND** it SHALL display files regardless of which tab or session captured them

#### Scenario: Empty library
- **WHEN** the global media list is empty
- **THEN** the Media Library SHALL show an empty state instead of a loading state

#### Scenario: VFS unavailable
- **WHEN** the VFS service is not connected
- **THEN** the Media Library SHALL show a disconnected state with a retry action
- **AND** it SHALL NOT present stale data as current

### Requirement: Virtualized masonry browsing
The Media Library SHALL display global media in a virtualized masonry grid with incremental loading.

#### Scenario: Initial media load
- **WHEN** the Media Library opens
- **THEN** it SHALL load the first page of media and render it in the masonry grid
- **AND** it SHALL show a loading indicator while the page is loading

#### Scenario: Infinite scroll
- **WHEN** the user scrolls near the end of the grid and more media exists
- **THEN** the Media Library SHALL request the next page
- **AND** it SHALL append the new items without replacing existing items

#### Scenario: Responsive column count
- **WHEN** the Media Library width changes
- **THEN** the masonry grid SHALL recompute its column count from the container width

#### Scenario: Reset pagination on filter change
- **WHEN** the user changes the active tag filter
- **THEN** the Media Library SHALL reset pagination and load the first page for that filter

### Requirement: Tag-driven filter tabs
The Media Library SHALL derive its filter tabs from the VFS tag vocabulary, pinned tags, and tag counts.

#### Scenario: Show system tabs
- **WHEN** the Media Library renders its filter tabs
- **THEN** it SHALL always show the system tabs for all media, images, videos, starred, and uncategorized

#### Scenario: Show user tag tabs
- **WHEN** the tag vocabulary contains pinned or high-usage user tags
- **THEN** the Media Library SHALL show those tags in the filter tab bar
- **AND** unpinned tags without usage SHALL NOT be shown

#### Scenario: Filter by tag
- **WHEN** the user selects a tag tab
- **THEN** the Media Library SHALL show only media matching that tag
- **AND** the selected tab SHALL be visually highlighted

#### Scenario: Show tag counts
- **WHEN** a tag tab is rendered
- **THEN** it SHALL display the number of matching files, including zero for system tabs

#### Scenario: Primary tag badge
- **WHEN** a media item has one or more content tags
- **THEN** its grid item SHALL display a badge derived from its primary tag
- **WHEN** a media item has no content tags
- **THEN** its grid item SHALL omit the badge

### Requirement: Media detail and metadata
The Media Library SHALL provide a media detail view for a selected item.

#### Scenario: Open media detail
- **WHEN** the user clicks a media item
- **THEN** the Media Library SHALL open a detail view for that item
- **AND** image and video previews SHALL use the local VFS file URL derived from the media hash

#### Scenario: Show detail title
- **WHEN** the detail view opens
- **THEN** it SHALL display the AI-generated filename when available
- **AND** it SHALL fall back to the media hash when no AI filename exists

#### Scenario: Show media metadata
- **WHEN** the detail view opens
- **THEN** it SHALL show the MIME type, size, capture time, hash, tags, and source URL when available

#### Scenario: Close media detail
- **WHEN** the user closes the detail view
- **THEN** the Media Library SHALL return to the grid without losing the current scroll position

### Requirement: Media management actions
The Media Library SHALL allow users to delete media and requeue AI work for a single item.

#### Scenario: Delete from detail view
- **WHEN** the user deletes the item shown in the detail view and confirms
- **THEN** the Media Library SHALL send a `deleteFile` message to the Background
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
The Media Library SHALL provide a delete action on each media grid item.

#### Scenario: Show delete action on hover
- **WHEN** the user hovers over a media grid item
- **THEN** a delete button SHALL appear on that item

#### Scenario: Delete without opening detail
- **WHEN** the user clicks the grid item's delete button
- **THEN** the media detail view SHALL NOT open
- **AND** the Media Library SHALL ask for confirmation

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

#### Scenario: Remove deleted media
- **WHEN** the Background relays a `file:deleted` event
- **THEN** the Media Library SHALL remove the item from the grid
- **AND** it SHALL close the detail view if it was showing that item
- **AND** the scroll position SHALL remain stable

### Requirement: Library is not a capture surface
The Media Library SHALL manage captured media only and SHALL NOT control capture sessions.

#### Scenario: No capture controls
- **WHEN** the Media Library tab renders
- **THEN** it SHALL NOT show a capture start or stop action
- **AND** it SHALL NOT show the active session live feed or event log
