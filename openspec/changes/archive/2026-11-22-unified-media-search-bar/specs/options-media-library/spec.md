## REMOVED Requirements

### Requirement: Media library search and structured filters

**Reason**: The separate search input and seven structured filter controls are replaced by one unified search bar. The dimensions remain available as query qualifiers defined by the `media-search-query` capability.

**Migration**: On first load, the Media Library converts the stored `LibraryFilters` object into query text and persists the new raw-query state. Users who relied on the type, site, date, status, tag, tag-mode, or starred controls use the equivalent query tokens instead.

## ADDED Requirements

### Requirement: Unified media search bar

The Media Library SHALL present search and filtering through one search input while preserving sort, tag tabs, and selection mode.

#### Scenario: Single search input
- **WHEN** the Media Library renders its header
- **THEN** it SHALL show one search input for text and dimensions
- **AND** it SHALL NOT show separate type, source-site, date, classification-status, tag, tag-mode, or starred filter controls

#### Scenario: Sort remains available
- **WHEN** the Media Library renders its header
- **THEN** the sort control SHALL remain available outside the search input

#### Scenario: Tag tabs remain shortcuts
- **WHEN** the Media Library renders the tag tab bar
- **THEN** the tab bar SHALL remain visible as a discovery shortcut
- **AND** selecting a tab SHALL update the search query rather than a separate tag filter state

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
- **AND** the library SHALL show the unfiltered result set

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
- **THEN** the raw query and sort SHALL be restored
- **AND** the results SHALL reflect the restored query

#### Scenario: Migrate the previous filter state
- **WHEN** the Media Library loads and only the previous filter object is stored
- **THEN** it SHALL convert that object into query text
- **AND** it SHALL persist the new query state
- **AND** it SHALL remove the previous filter key

#### Scenario: Unparseable previous state
- **WHEN** the previous filter state cannot be converted
- **THEN** the Media Library SHALL start with an empty query
- **AND** it SHALL remain usable

## MODIFIED Requirements

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
