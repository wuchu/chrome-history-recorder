## REMOVED Requirements

### Requirement: Single tag selection
**Reason**: The media library now supports selecting several tags at once, with an explicit match mode. Keeping a single-selection requirement would conflict with the new filter model.
**Migration**: Existing single-tag behavior remains available by selecting exactly one tag. The tag tabs continue to act as a one-click shortcut for a single tag.

## ADDED Requirements

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
