## MODIFIED Requirements

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
