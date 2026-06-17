# Multi Tag Filtering

## Purpose

Provide tag-based filtering in the DevTools Panel so users can browse captured media by system and user-defined tags.

## Requirements

### Requirement: Scrollable tag tab bar
The system SHALL provide a scrollable tab bar for tag-based filtering in DevTools Panel.

#### Scenario: Always show "All" tab
- **WHEN** the media grid is displayed
- **THEN** the system SHALL always show an "All" tab as the first option
- **AND** the "All" tab SHALL show all media files when selected

#### Scenario: Display only tags with files
- **WHEN** the tag tab bar is rendered
- **THEN** the system SHALL only display tags that have at least one associated media file
- **AND** empty tags SHALL NOT be shown in the tab bar

#### Scenario: Tab order
- **WHEN** tags are displayed in the tab bar
- **THEN** system tags SHALL appear first in sortOrder
- **AND** user-defined tags SHALL follow in their configured sortOrder

#### Scenario: Scrollable tabs
- **WHEN** there are more tags than can fit in the available width
- **THEN** the tab bar SHALL be horizontally scrollable
- **AND** left/right scroll indicators SHALL be provided

### Requirement: Single tag selection
The system SHALL support single tag selection for filtering.

#### Scenario: Select tag tab
- **WHEN** user clicks on a tag tab
- **THEN** the system SHALL filter the media grid to show only files with that tag
- **AND** the selected tab SHALL be visually highlighted

#### Scenario: Switch between tags
- **WHEN** user clicks on a different tag tab
- **THEN** the system SHALL update the filter to the newly selected tag
- **AND** the media grid SHALL refresh with the filtered results

#### Scenario: Return to all
- **WHEN** user clicks the "All" tab
- **THEN** the system SHALL remove the tag filter
- **AND** all media files SHALL be displayed

### Requirement: Tag-based file filtering API
The system SHALL provide an API to filter files by tag.

#### Scenario: Filter by tag name
- **WHEN** a tag filter is requested
- **THEN** the system SHALL return files that have the specified tag in either system_tags or user_tags

#### Scenario: Get tag usage counts
- **WHEN** the tag tab bar is rendered
- **THEN** the system SHALL compute the number of files per tag
- **AND** the count MAY be displayed next to the tag label
