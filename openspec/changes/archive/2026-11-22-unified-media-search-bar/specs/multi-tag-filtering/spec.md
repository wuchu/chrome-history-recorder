## MODIFIED Requirements

### Requirement: Multi-tag selection

The system SHALL support filtering by more than one tag through tag tokens in the unified search bar, without a separate match-mode control.

#### Scenario: Select multiple tags
- **WHEN** the query contains two or more `tag:` tokens
- **THEN** the media grid SHALL be filtered by the resulting tag expression
- **AND** each tag condition SHALL be visibly listed as an applied chip

#### Scenario: Match all tags
- **WHEN** the query repeats tag tokens, such as `tag:猫 tag:壁纸`
- **THEN** the grid SHALL show only files that contain every selected tag

#### Scenario: Match any tag
- **WHEN** the query uses a pipe inside a tag value, such as `tag:猫|狗`
- **THEN** the grid SHALL show files that contain at least one tag from that group

#### Scenario: Mixed tag expression
- **WHEN** the query combines an OR group and another tag token
- **THEN** the grid SHALL apply the OR group and the additional tag with AND

#### Scenario: Remove one tag
- **WHEN** the user removes one tag condition
- **THEN** the grid SHALL re-query with the remaining tag conditions
- **AND** pagination SHALL reset to the first page

#### Scenario: Clear all tags
- **WHEN** the user removes every tag condition
- **THEN** the tag constraint SHALL be removed
- **AND** the other active query conditions SHALL remain in effect

#### Scenario: No separate match-mode control
- **WHEN** the Media Library renders its search and tag controls
- **THEN** it SHALL NOT show a standalone tag-mode selector
- **AND** the match mode SHALL be determined by the tag token syntax

### Requirement: All tags access

The search suggestion surface SHALL make the entire tag vocabulary reachable, including tags that are not visible in the tab bar.

#### Scenario: Open tag suggestions
- **WHEN** the user types `tag:` or enters tag-like text in the search input
- **THEN** the system SHALL show matching tags from the vocabulary with their usage counts
- **AND** pinned tags SHALL be identifiable

#### Scenario: Search tag suggestions
- **WHEN** the user continues typing after `tag:`
- **THEN** the system SHALL filter the tag suggestions by name or label
- **AND** tags beyond the tab-bar limit SHALL remain selectable

#### Scenario: Select from suggestions
- **WHEN** the user selects a tag suggestion
- **THEN** the tag SHALL be added as a `tag:` token in the query
- **AND** the media grid SHALL re-query with the updated tag expression

#### Scenario: Tab shortcut still works
- **WHEN** the user clicks a tag tab
- **THEN** the system SHALL replace the existing tag tokens with that single tag
- **AND** it SHALL leave non-tag conditions intact
- **AND** the tab SHALL be visually active only when the query contains exactly that one tag token and no tag OR group
