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

### Requirement: Grid primary tag badge
The Media Library SHALL display a primary-tag badge on grid items that have content tags.

#### Scenario: Item has content tags
- **WHEN** a media item has one or more content tags
- **THEN** its grid item SHALL display a badge derived from its primary tag

#### Scenario: Item has no content tags
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

### Requirement: Library is not a capture surface
The Media Library SHALL manage captured media only and SHALL NOT control capture sessions.

#### Scenario: No capture controls
- **WHEN** the Media Library tab renders
- **THEN** it SHALL NOT show a capture start or stop action
- **AND** it SHALL NOT show the active session live feed or event log

### Requirement: Unified media search bar

The Media Library SHALL present search and filtering through one search input while preserving sort, the library/trash view switch, and selection mode.

#### Scenario: Single search input
- **WHEN** the Media Library renders its header
- **THEN** it SHALL show one search input for text and dimensions
- **AND** it SHALL NOT show separate type, source-site, date, classification-status, tag, tag-mode, or starred filter controls
- **AND** it SHALL NOT show a tag tab bar

#### Scenario: Sort remains available
- **WHEN** the Media Library renders its header in the active view
- **THEN** the sort control SHALL remain available outside the search input

#### Scenario: View switch remains available
- **WHEN** the Media Library renders its header
- **THEN** the active/trash view switch SHALL remain available outside the search input
- **AND** switching the view SHALL NOT alter the query text

#### Scenario: Applied conditions
- **WHEN** the query contains one or more recognized conditions
- **THEN** the header SHALL show each condition as a removable chip below the input
- **AND** it SHALL show the matching result count
- **AND** it SHALL offer a clear-all action

#### Scenario: Remove one condition
- **WHEN** the user removes one condition chip
- **THEN** the query SHALL be rewritten without that condition
- **AND** the results SHALL refresh
- **AND** pagination SHALL reset to the first page

#### Scenario: Clear all conditions
- **WHEN** the user clears the search bar or activates clear-all
- **THEN** all text and dimension conditions SHALL be removed
- **AND** the library SHALL show the unfiltered result set for the current view

#### Scenario: Search updates results
- **WHEN** the parsed query changes
- **THEN** the Media Library SHALL request the filtered result set after a short debounce
- **AND** it SHALL discard stale responses from earlier queries

#### Scenario: Suggestions anchored to the input
- **WHEN** the user focuses or types in the search input
- **THEN** suggestions SHALL appear anchored to the input
- **AND** the result grid SHALL remain visible behind or beside the suggestion surface

#### Scenario: Persist the view
- **WHEN** the user leaves the Media Library tab and returns during the same Options page session
- **THEN** the raw query, sort, and active/trash view SHALL be restored
- **AND** the results SHALL reflect the restored query and view

#### Scenario: Migrate the previous filter state
- **WHEN** the Media Library loads and only the previous filter object is stored
- **THEN** it SHALL convert that object into query text
- **AND** it SHALL persist the new query state
- **AND** it SHALL remove the previous filter key

#### Scenario: Unparseable previous state
- **WHEN** the previous filter state cannot be converted
- **THEN** the Media Library SHALL start with an empty query and the active view
- **AND** it SHALL remain usable

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

The Media Library SHALL let users star, download, and navigate a single item from the detail view. Tags SHALL be read-only, and the detail view SHALL NOT include a notes editor.

#### Scenario: Star and unstar
- **WHEN** the user toggles the star control in the detail view
- **THEN** the item's star state SHALL be persisted through VFS
- **AND** the detail view and grid SHALL reflect the new state

#### Scenario: Tags are read-only
- **WHEN** the detail view opens
- **THEN** it SHALL display each tag as `#tag`
- **AND** system tags SHALL display without the `system:` prefix
- **AND** it SHALL NOT provide add, remove, or create-tag controls

#### Scenario: No notes editor
- **WHEN** the detail view opens
- **THEN** it SHALL NOT show a notes field or a save-notes action

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
- **WHEN** the current query produces no results
- **THEN** the empty state SHALL offer to remove one active condition, clear all conditions, or try a matching tag or site
- **AND** it SHALL NOT require the user to edit the raw query manually

#### Scenario: Backend disconnected
- **WHEN** the VFS connection is unavailable
- **THEN** the library SHALL show the existing warning with a reconnect action
- **AND** it SHALL disable the search input and batch actions that require the backend

#### Scenario: Reconnect
- **WHEN** the VFS connection is restored
- **THEN** the library SHALL refresh the current query automatically
- **AND** it SHALL refresh tag counts and source-domain suggestions

### Requirement: Stable live list updates

The Media Library SHALL merge live capture events without duplicating items, drifting the total, or degrading as the session grows.

#### Scenario: New live item
- **WHEN** the active view has no search or filters active and a `file:captured` event arrives
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

#### Scenario: Tag refresh uses the event payload
- **WHEN** the latest Background event is `tags:updated`
- **THEN** the Media Library SHALL update its tag vocabulary from the event's `{ tags, counts }` payload
- **AND** it SHALL NOT issue another `listTags` request for that event
- **AND** unrelated events SHALL NOT trigger tag refreshes

#### Scenario: Tag refresh falls back for payload-less events
- **WHEN** a tag-related event arrives without a usable payload
- **THEN** the Media Library MAY refresh the tag vocabulary once, debounced

#### Scenario: Coalesced snapshots update once
- **WHEN** several `tags:updated` events arrive in a burst
- **THEN** the Media Library SHALL apply the latest snapshot once
- **AND** it SHALL NOT queue one network request per event

#### Scenario: Trash view does not retain the full event log
- **WHEN** the trash view observes Background events
- **THEN** it SHALL handle only `file:trashed`, `file:restored`, `file:purged`, `trash:emptied`, and `trash:restored-all` through a listener
- **AND** it SHALL NOT accumulate the full bounded event history
- **AND** it SHALL NOT merge live capture items into the trash grid

### Requirement: Trash view

The Media Library SHALL provide a trash view that exposes the recycle-bin capability in place of a separate console section.

#### Scenario: Switch to the trash view
- **WHEN** the user selects 回收站 in the library view switch
- **THEN** the library SHALL show only trashed media ordered newest-deleted first
- **AND** the URL SHALL update to `#library?view=trash`
- **AND** the Media Library navigation item SHALL remain active

#### Scenario: Switch back to active media
- **WHEN** the user selects 媒体库 in the view switch
- **THEN** the library SHALL show only active media using the current query and sort
- **AND** the URL SHALL update to `#library`

#### Scenario: Show trash count
- **WHEN** the library renders the view switch
- **THEN** it SHALL show the number of trashed items
- **AND** it MAY show the trash storage size when available

#### Scenario: Search within the trash view
- **WHEN** the user modifies the query while the trash view is active
- **THEN** the library SHALL apply the query to trashed media only
- **AND** pagination SHALL reset to the first page
- **AND** the sort control SHALL be hidden because trash order is fixed to newest-deleted first

#### Scenario: Restore one item
- **WHEN** the user restores an item from the trash detail view or grid
- **THEN** the library SHALL send a `restoreFile` message for that hash
- **AND** upon success it SHALL remove the item from the trash grid and refresh the trash count

#### Scenario: Permanently delete one item
- **WHEN** the user permanently deletes an item and confirms
- **THEN** the library SHALL send a `purgeFile` message for that hash
- **AND** the confirmation SHALL state that the data and archived copy cannot be recovered
- **AND** upon success it SHALL remove the item from the grid and refresh the trash count

#### Scenario: Batch actions in the trash view
- **WHEN** selection mode is active in the trash view
- **THEN** the selection bar SHALL offer restore-selected, permanently-delete-selected, select-visible, and clear-selection actions
- **AND** both destructive actions SHALL require confirmation
- **AND** the bar SHALL NOT offer classify, rename, or export actions

#### Scenario: Empty the trash
- **WHEN** the user empties the trash and confirms
- **THEN** the library SHALL permanently remove all trashed media
- **AND** the grid SHALL show the trash empty state
- **AND** the trash count SHALL become zero

#### Scenario: Empty trash state
- **WHEN** no files are in the trash
- **THEN** the trash view SHALL show an empty state
- **AND** restore-all, empty-trash, and batch actions SHALL be disabled

#### Scenario: Changing the view resets transient state
- **WHEN** the user switches between the active and trash views
- **THEN** the library SHALL clear the selection, close any open detail view, and reset pagination

#### Scenario: Trash view contains no capture controls
- **WHEN** the trash view renders
- **THEN** it SHALL NOT provide controls to start or stop a capture session

#### Scenario: Trash refresh on lifecycle events
- **WHEN** a `file:trashed`, `file:restored`, `file:purged`, `trash:emptied`, or `trash:restored-all` event arrives while the trash view is active
- **THEN** the library SHALL refresh the trash listing and count

### Requirement: Media detail action tiers

The Media Library detail view SHALL keep primary actions visible and group secondary actions and metadata.

#### Scenario: Primary actions remain visible
- **WHEN** the detail view opens for active media
- **THEN** previous/next, star, download, delete, and close SHALL be directly available

#### Scenario: Secondary actions are grouped
- **WHEN** the detail view opens for active media
- **THEN** re-classify and re-name SHALL be reachable from a single overflow menu

#### Scenario: Secondary metadata is collapsed
- **WHEN** the detail view opens
- **THEN** type, size, and captured time SHALL be visible without expanding anything
- **AND** source URL, hash, model, confidence, and other secondary fields SHALL be available behind a 详情 disclosure

#### Scenario: Trash mode replaces library actions
- **WHEN** the detail view opens from the trash view
- **THEN** restore and permanent delete SHALL replace the library curation actions
- **AND** the 详情 disclosure SHALL remain available
