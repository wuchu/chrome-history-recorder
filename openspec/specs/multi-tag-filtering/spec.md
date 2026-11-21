# Multi Tag Filtering

## Purpose

Provide tag-based filtering in the Options media library so users can browse captured media by system and user-defined tags.

## Requirements

### Requirement: Scrollable tag tab bar
The system SHALL provide a scrollable tab bar for tag-based filtering in the Options media library.

#### Scenario: Always show "All" tab
- **WHEN** the media grid is displayed
- **THEN** the system SHALL always show an "All" tab as the first option
- **AND** the "All" tab SHALL show all media files when selected

#### Scenario: Display only user tags with files
- **WHEN** the tag tab bar is rendered
- **THEN** the system SHALL only display user-defined tags that have at least one associated media file
- **AND** system tabs SHALL remain visible as defined by the system-tabs-always-visible capability

#### Scenario: Tab order
- **WHEN** tags are displayed in the tab bar
- **THEN** system tags SHALL appear first in sortOrder
- **AND** user-defined tags SHALL follow in their configured sortOrder

#### Scenario: Scrollable tabs
- **WHEN** there are more tags than can fit in the available width
- **THEN** the tab bar SHALL be horizontally scrollable
- **AND** left/right scroll indicators SHALL be provided

### Requirement: Multi-tag selection
The system SHALL support selecting more than one tag for filtering and SHALL let the user choose whether files must match all selected tags or any selected tag.

#### Scenario: Select multiple tags
- **WHEN** the user selects two or more tags
- **THEN** the media grid SHALL be filtered by the selected tag set
- **AND** the selected tags SHALL be visibly listed in the filter bar

#### Scenario: Match all tags
- **WHEN** the match mode is "all"
- **THEN** the grid SHALL show only files that contain every selected tag

#### Scenario: Match any tag
- **WHEN** the match mode is "any"
- **THEN** the grid SHALL show files that contain at least one selected tag

#### Scenario: Remove one tag
- **WHEN** the user removes one tag from the selection
- **THEN** the grid SHALL re-query with the remaining tags
- **AND** pagination SHALL reset to the first page

#### Scenario: Clear all tags
- **WHEN** the user clears the tag selection
- **THEN** the tag constraint SHALL be removed
- **AND** the other active filters SHALL remain in effect

### Requirement: All tags access
The system SHALL make the entire tag vocabulary reachable, including tags that are not visible in the tab bar.

#### Scenario: Open the tag picker
- **WHEN** the user opens the tag picker
- **THEN** the system SHALL show all tags from the vocabulary with their usage counts
- **AND** pinned tags SHALL be identifiable

#### Scenario: Search the tag picker
- **WHEN** the user types in the tag picker
- **THEN** the system SHALL filter the tag list by name
- **AND** tags beyond the tab-bar limit SHALL remain selectable

#### Scenario: Select from the picker
- **WHEN** the user selects a tag in the picker
- **THEN** the tag SHALL be added to the active tag selection
- **AND** the media grid SHALL re-query with the new selection

#### Scenario: Tab shortcut still works
- **WHEN** the user clicks a tag tab
- **THEN** the system SHALL replace the tag selection with that single tag
- **AND** the match mode SHALL have no effect with one tag

### Requirement: Multi-tag filtering API
The system SHALL provide an API that filters files by a set of tags and a match mode.

#### Scenario: Filter by tag set
- **WHEN** a tag filter request contains `tags: string[]`
- **THEN** the system SHALL return files matching the set according to `tagMode`

#### Scenario: Tag mode default
- **WHEN** `tagMode` is omitted
- **THEN** the system SHALL default to "any"

#### Scenario: Empty tag set
- **WHEN** the tag set is empty
- **THEN** the system SHALL apply no tag constraint

#### Scenario: System tag forms
- **WHEN** a selected tag is a system tag
- **THEN** the system SHALL match both its plain and `system:`-prefixed forms

### Requirement: Tag-based file filtering API
The system SHALL provide an API to filter files by tag.

#### Scenario: Filter by tag name
- **WHEN** a tag filter is requested
- **THEN** the system SHALL return files that have the specified tag in either system_tags or user_tags

#### Scenario: Get tag usage counts
- **WHEN** the tag tab bar is rendered
- **THEN** the system SHALL compute the number of files per tag
- **AND** the count MAY be displayed next to the tag label
