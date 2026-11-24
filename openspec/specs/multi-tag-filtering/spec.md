# Multi Tag Filtering

## Purpose

Provide tag-based filtering in the Options media library so users can browse captured media by system and user-defined tags.

## Requirements

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
- **WHEN** tag suggestions are rendered
- **THEN** the system SHALL compute the number of files per tag
- **AND** the count MAY be displayed next to the tag label
