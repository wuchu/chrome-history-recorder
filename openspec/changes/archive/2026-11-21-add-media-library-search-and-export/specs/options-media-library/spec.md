## ADDED Requirements

### Requirement: Media library search and structured filters

The Media Library SHALL let users narrow the global library with free-text search and structured filters.

#### Scenario: Free-text search
- **WHEN** the user enters a search term
- **THEN** the Media Library SHALL request files whose AI filename, tags, source URL, or user notes match the term
- **AND** the grid SHALL show only matching files

#### Scenario: Type filter
- **WHEN** the user selects an image or video type filter
- **THEN** the Media Library SHALL show only files of that MIME family

#### Scenario: Source site filter
- **WHEN** the user selects a source site
- **THEN** the Media Library SHALL show only files captured from that source domain

#### Scenario: Date range filter
- **WHEN** the user selects a captured-date range
- **THEN** the Media Library SHALL show only files captured inside that range

#### Scenario: Classification status filter
- **WHEN** the user selects a classification status
- **THEN** the Media Library SHALL show only files with that classify/rename task state

#### Scenario: Starred filter
- **WHEN** the user enables the starred filter
- **THEN** the Media Library SHALL show only starred files

#### Scenario: Combine filters
- **WHEN** multiple filters are active
- **THEN** the Media Library SHALL apply them together
- **AND** it SHALL reset pagination to the first page

#### Scenario: Clear filters
- **WHEN** the user clears the search and filters
- **THEN** the Media Library SHALL return to the unfiltered library

#### Scenario: Persist the view
- **WHEN** the user leaves the Media Library tab and returns
- **THEN** the search, filters, sort, and active tag selection SHALL be restored for that Options page session

### Requirement: Media library sort control

The Media Library SHALL let users choose the ordering of the result set.

#### Scenario: Sort options
- **WHEN** the user opens the sort control
- **THEN** the Media Library SHALL offer newest first, oldest first, largest first, smallest first, highest confidence first, and AI filename A–Z

#### Scenario: Sort changes the query
- **WHEN** the user selects a sort
- **THEN** the Media Library SHALL request the filtered result set in that order
- **AND** it SHALL reset pagination to the first page

### Requirement: Multi-select and batch actions

The Media Library SHALL support selecting multiple visible media items and acting on the selection.

#### Scenario: Enter selection mode
- **WHEN** the user activates selection mode
- **THEN** each grid item SHALL expose a selection control
- **AND** a selection toolbar SHALL show the selected count

#### Scenario: Select and clear
- **WHEN** the user toggles an item
- **THEN** the item SHALL be added to or removed from the selection
- **AND** the grid SHALL show the selected state without opening the detail view

#### Scenario: Select the visible page
- **WHEN** the user chooses "select visible"
- **THEN** every currently loaded item that matches the active filters SHALL be selected

#### Scenario: Batch trash
- **WHEN** the user confirms trashing the selection
- **THEN** the Media Library SHALL move each selected item to the trash
- **AND** it SHALL remove successful items from the grid
- **AND** it SHALL report how many items failed and why

#### Scenario: Batch requeue
- **WHEN** the user chooses classify or rename for the selection
- **THEN** the Media Library SHALL requeue that task type for each selected item
- **AND** it SHALL report per-item failures

#### Scenario: Batch export
- **WHEN** the user chooses export for the selection
- **THEN** the Media Library SHALL start the export flow with the selected hashes

#### Scenario: Leave selection mode
- **WHEN** the user exits selection mode
- **THEN** the selection SHALL be cleared
- **AND** normal item click SHALL open the detail view again

### Requirement: Media detail curation actions

The Media Library SHALL let users curate a single item from the detail view without losing AI or system metadata.

#### Scenario: Star and unstar
- **WHEN** the user toggles the star control in the detail view
- **THEN** the item's star state SHALL be persisted through VFS
- **AND** the detail view and grid SHALL reflect the new state

#### Scenario: Edit notes
- **WHEN** the user saves notes for an item
- **THEN** the notes SHALL be persisted through VFS
- **AND** the search index SHALL include the new notes text

#### Scenario: Add a tag
- **WHEN** the user adds a tag to an item
- **THEN** the tag SHALL be added if it is missing
- **AND** existing system tags and other user tags SHALL be preserved

#### Scenario: Remove a tag
- **WHEN** the user removes a user tag from an item
- **THEN** that tag SHALL be removed from the item
- **AND** system tags SHALL NOT be removable

#### Scenario: Create a user tag while assigning
- **WHEN** the user enters a tag name that is not in the vocabulary
- **THEN** the tag SHALL be created with `created_by = 'user'`
- **AND** it SHALL be assigned to the item

#### Scenario: Download original
- **WHEN** the user chooses download in the detail view
- **THEN** the browser SHALL download the original file using the server-provided download name

#### Scenario: Navigate between items
- **WHEN** the user presses the previous or next control, or the left/right arrow key while the detail view is open
- **THEN** the detail view SHALL show the adjacent item in the current filtered order
- **AND** navigation SHALL stop at the first or last item
- **AND** the detail view SHALL NOT close

### Requirement: Empty and disconnected states

The Media Library SHALL explain what to do when there is nothing to show or the backend is unavailable.

#### Scenario: Empty library
- **WHEN** the library has no media
- **THEN** the grid SHALL show an empty state explaining that captured media will appear here
- **AND** it SHALL point the user to the Side Panel to start a capture session

#### Scenario: No matching results
- **WHEN** filters or search produce no results
- **THEN** the empty state SHALL offer to clear the filters

#### Scenario: Backend disconnected
- **WHEN** the VFS connection is unavailable
- **THEN** the library SHALL show the existing warning with a reconnect action
- **AND** it SHALL disable search, filters, and batch actions that require the backend

#### Scenario: Reconnect
- **WHEN** the VFS connection is restored
- **THEN** the library SHALL refresh the current query automatically
- **AND** it SHALL refresh tag counts

### Requirement: Stable live list updates

The Media Library SHALL merge live capture events without duplicating items, drifting the total, or degrading as the session grows.

#### Scenario: New live item
- **WHEN** no search or filters are active and a `file:captured` event arrives
- **THEN** the Media Library SHALL insert the item once at the top of the grid
- **AND** the header total SHALL increase by one if the item was not already loaded

#### Scenario: Filters are active
- **WHEN** a search or filter is active and a capture or classification event arrives
- **THEN** the Media Library SHALL debounce a query refresh instead of inserting an unfiltered live item

#### Scenario: Duplicate append
- **WHEN** a page or event returns a hash that is already in the list
- **THEN** the Media Library SHALL keep one item for that hash
- **AND** it SHALL NOT create a duplicate grid entry

#### Scenario: Bounded event history
- **WHEN** capture runs for a long time
- **THEN** the retained Background event log SHALL be capped
- **AND** live item/status state SHALL be derived incrementally rather than by rescanning all retained events

#### Scenario: Tag refresh is event-driven
- **WHEN** the latest Background event is a classification or tag event
- **THEN** the Media Library SHALL refresh tag counts and vocabulary once, debounced
- **AND** unrelated events SHALL NOT trigger tag refreshes
