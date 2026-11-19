## ADDED Requirements

### Requirement: Primary tag badge
The Side Panel SHALL display a media item's primary tag as its grid badge instead of the legacy category field.

#### Scenario: Show primary tag
- **WHEN** a media item has one or more content tags
- **THEN** the grid item SHALL display a badge derived from its primary tag
- **WHEN** a media item has no content tags
- **THEN** the grid item SHALL omit the badge

### Requirement: Tag-driven tab bar
The Side Panel SHALL derive its tag tabs from the VFS tag vocabulary and pinned preferences.

#### Scenario: Show pinned tabs
- **WHEN** tags are pinned in the vocabulary
- **THEN** the Side Panel SHALL display them in the tab bar regardless of usage

#### Scenario: Show high-usage tabs
- **WHEN** unpinned tags exist with files
- **THEN** the Side Panel SHALL display the top tags by usage subject to a bounded tab count

#### Scenario: Refresh tabs after vocabulary change
- **WHEN** the tag vocabulary changes
- **THEN** the Side Panel SHALL refresh its tabs and counts from VFS

## MODIFIED Requirements

### Requirement: Side Panel media browsing
The Side Panel SHALL provide the primary media browsing experience using VFS-backed media records, thumbnails, and the tag vocabulary.

#### Scenario: Load historical media
- **WHEN** the Side Panel opens
- **THEN** it SHALL request historical media from Background using the supported `listFiles` message protocol
- **AND** it SHALL display returned media in a virtualized masonry grid

#### Scenario: Display real-time captures
- **WHEN** Background broadcasts a `file:captured` event
- **THEN** the Side Panel SHALL add the captured media to the live capture stream
- **AND** it SHALL merge the media into the grid without duplicating an existing hash

#### Scenario: Tag-filtered browsing
- **WHEN** the user selects a system, pinned, or vocabulary tag in the Side Panel
- **THEN** the Side Panel SHALL filter historical and newly captured media by that tag
- **AND** it SHALL preserve pagination behavior for the selected filter

#### Scenario: AI metadata updates
- **WHEN** Background broadcasts an AI task completion event
- **THEN** the Side Panel SHALL update the affected media's tags or display filename without a full reload
