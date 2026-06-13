## ADDED Requirements

### Requirement: Scrollable tag tab bar
The DevTools Panel SHALL provide a scrollable tag tab bar above the media grid.

#### Scenario: Tab bar placement
- **WHEN** the DevTools Panel is displayed
- **THEN** the tag tab bar SHALL appear below the Classify Progress Section and above the media grid
- **AND** the tab bar SHALL replace the old MediaTabs (images/videos)

#### Scenario: Scroll functionality
- **WHEN** there are more tags than fit in the tab bar width
- **THEN** the tab bar SHALL support horizontal scrolling
- **AND** visual scroll indicators SHALL be provided

### Requirement: Tag display in media cards
The media cards SHALL display associated tags.

#### Scenario: Show tags on card
- **WHEN** a media card is displayed
- **THEN** the system SHALL show the tags associated with the file
- **AND** system tags MAY be visually distinguished from user tags

## MODIFIED Requirements

### Requirement: Media details panel
The DevTools Panel SHALL provide a media details panel that supports tag management.

#### Scenario: Display tags in details
- **WHEN** the media details panel is open
- **THEN** the system SHALL display the file's system tags and user tags
- **AND** system tags SHALL be marked as read-only

#### Scenario: Edit user tags in details
- **WHEN** the media details panel is open
- **THEN** the system SHALL allow users to add/remove user tags for the file
- **AND** changes SHALL be saved immediately

#### Scenario: Classification result details
- **WHEN** the media has been classified
- **THEN** the system SHALL display detailed classification information:
  - Tags: list of assigned tags
  - Filename: AI-generated filename
  - Confidence: confidence progress bar
