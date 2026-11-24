## MODIFIED Requirements

### Requirement: All tags access

The search suggestion surface SHALL be the tag picker and SHALL make the entire tag vocabulary reachable.

#### Scenario: Open tag suggestions
- **WHEN** the user types `tag:` or enters tag-like text in the search input
- **THEN** the system SHALL show matching tags from the vocabulary with their usage counts
- **AND** pinned tags SHALL be identifiable

#### Scenario: Search tag suggestions
- **WHEN** the user continues typing after `tag:`
- **THEN** the system SHALL filter the tag suggestions by name or label
- **AND** every tag in the vocabulary SHALL remain selectable

#### Scenario: Select from suggestions
- **WHEN** the user selects a tag suggestion
- **THEN** the tag SHALL be added as a `tag:` token in the query
- **AND** the media grid SHALL re-query with the updated tag expression

#### Scenario: No tab bar shortcut
- **WHEN** the Media Library renders its search and tag controls
- **THEN** it SHALL NOT render a tag tab bar
- **AND** tag selection SHALL occur only through query tokens or suggestions

### Requirement: Tag-based file filtering API
The system SHALL provide an API to filter files by tag.

#### Scenario: Filter by tag name
- **WHEN** a tag filter is requested
- **THEN** the system SHALL return files that have the specified tag in either system_tags or user_tags

#### Scenario: Get tag usage counts
- **WHEN** tag suggestions are rendered
- **THEN** the system SHALL compute the number of files per tag
- **AND** the count MAY be displayed next to the tag label

## REMOVED Requirements

### Requirement: Scrollable tag tab bar
**Reason**: The tag tab bar was a second tag-filtering model beside the unified search bar. It owned separate active-tab state, required separate tag-count fetching, and stopped being the authoritative filter after search unification.
**Migration**: Use `tag:<name>` or `#<name>` tokens in the search input, or pick a tag from the search suggestions. Pinned and high-usage tags remain visible in suggestions with their counts. Applied tag conditions remain visible as removable chips.
