## ADDED Requirements

### Requirement: Multi-select mode

The masonry grid SHALL support a selection mode in which item clicks toggle selection instead of opening the detail view.

#### Scenario: Enter selection mode
- **WHEN** the host enables selection mode
- **THEN** each rendered item SHALL show a selection control
- **AND** clicking an item SHALL toggle its selected state
- **AND** the detail view SHALL NOT open

#### Scenario: Selected state is visible
- **WHEN** an item is selected
- **THEN** the item SHALL show a distinct selected visual state
- **AND** the state SHALL remain when the item scrolls out of view and back in

#### Scenario: Exit selection mode
- **WHEN** the host disables selection mode
- **THEN** selection controls SHALL be hidden
- **AND** clicking an item SHALL open the detail view again

#### Scenario: Preserve scroll on selection
- **WHEN** the user toggles selection on an item
- **THEN** the grid scroll position SHALL NOT jump

### Requirement: Stable incremental pages

The grid SHALL append pages and live items without creating duplicate hashes or dropping an item when filters change.

#### Scenario: Duplicate item across pages
- **WHEN** a newly loaded page contains a hash already present in the grid
- **THEN** the grid SHALL keep exactly one item for that hash

#### Scenario: Page arrives after a filter change
- **WHEN** a page request for an old filter resolves after the user changed the filter
- **THEN** the grid SHALL discard that response
- **AND** it SHALL keep the results for the current filter

#### Scenario: New item arrives while loading
- **WHEN** a live item arrives while the next page is loading
- **THEN** the live item SHALL appear once
- **AND** the page append SHALL NOT duplicate it

#### Scenario: Stable keys
- **WHEN** items are inserted at the top of the grid
- **THEN** existing items SHALL keep stable keys
- **AND** their rendered state SHALL NOT be reset

### Requirement: Scroll latch recovery

The grid SHALL continue loading pages while the end region remains visible, not only on a subsequent user scroll.

#### Scenario: Short page remains at the end
- **WHEN** a page finishes loading and the end region is still visible and more items exist
- **THEN** the grid SHALL request the next page automatically

#### Scenario: End region leaves the viewport
- **WHEN** the end region is no longer visible
- **THEN** the grid SHALL wait for it to become visible again before requesting more

#### Scenario: Loading guard
- **WHEN** a page request is already in flight
- **THEN** the grid SHALL NOT issue another request for the same end region

#### Scenario: No more items
- **WHEN** `hasMore` is false
- **THEN** the grid SHALL stop requesting pages
- **AND** it SHALL show the end-of-list indicator
