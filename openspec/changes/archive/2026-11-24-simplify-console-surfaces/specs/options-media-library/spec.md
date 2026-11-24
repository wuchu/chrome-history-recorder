## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Grid primary tag badge
The Media Library SHALL display a primary-tag badge on grid items that have content tags.

#### Scenario: Item has content tags
- **WHEN** a media item has one or more content tags
- **THEN** its grid item SHALL display a badge derived from its primary tag

#### Scenario: Item has no content tags
- **WHEN** a media item has no content tags
- **THEN** its grid item SHALL omit the badge

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

## REMOVED Requirements

### Requirement: Tag-driven filter tabs
**Reason**: The unified search bar is now the only tag-filtering model. The tab bar duplicated tag query state, required separate tag-count fetching, and presented a second way to filter by tag.
**Migration**: Type `tag:<name>` or `#<name>` in the search input, or select a tag from the search suggestions. Pinned tags remain identifiable in suggestions, and applied tag conditions remain visible as chips. The grid primary-tag badge is preserved as a separate requirement.
