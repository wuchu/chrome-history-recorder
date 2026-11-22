## ADDED Requirements

### Requirement: Single-box media query grammar

The Media Library SHALL accept one query string that combines free terms, quoted phrases, negated terms, and known dimension qualifiers.

#### Scenario: Free terms
- **WHEN** the user enters bare words such as `猫 壁纸`
- **THEN** the parser SHALL treat each word as a free term
- **AND** the terms SHALL be combined with AND

#### Scenario: Quoted phrase
- **WHEN** the user wraps text in double quotes
- **THEN** the parser SHALL treat the quoted text as one contiguous phrase

#### Scenario: Negated term
- **WHEN** a free term is prefixed with `-`
- **THEN** the parser SHALL exclude files that match that term

#### Scenario: Unknown qualifier
- **WHEN** the input contains `foo:bar` and `foo` is not a known qualifier
- **THEN** the parser SHALL treat the whole token as free text
- **AND** it SHALL NOT produce a structured facet

#### Scenario: URL-like text
- **WHEN** the input contains a URL with a colon
- **THEN** the parser SHALL NOT interpret the URL scheme as a qualifier

#### Scenario: Incomplete qualifier
- **WHEN** the input ends with a known qualifier and no value, such as `tag:`
- **THEN** the parser SHALL NOT apply a filter for that qualifier
- **AND** the suggestion surface SHALL offer valid values

### Requirement: Query dimension qualifiers

The parser SHALL map known qualifier names and aliases to structured query dimensions.

#### Scenario: Tag qualifier
- **WHEN** the input contains `tag:风景`, `标签:风景`, or `#风景`
- **THEN** the parser SHALL apply the `风景` tag filter

#### Scenario: Tag OR group
- **WHEN** the input contains `tag:风景|cat`
- **THEN** the parser SHALL match files containing either `风景` or `cat`

#### Scenario: Site qualifier
- **WHEN** the input contains `site:pixiv.net` or `站点:pixiv.net`
- **THEN** the parser SHALL apply a source-domain filter for `pixiv.net`

#### Scenario: Type qualifier
- **WHEN** the input contains `type:image`, `type:video`, `类型:图片`, or `类型:视频`
- **THEN** the parser SHALL apply the corresponding media type filter

#### Scenario: Status qualifier
- **WHEN** the input contains `status:failed` or `状态:失败`
- **THEN** the parser SHALL apply the corresponding classification status filter

#### Scenario: Relative date qualifier
- **WHEN** the input contains `date:today`, `date:7d`, `date:30d`, `时间:今天`, or `时间:最近7天`
- **THEN** the parser SHALL compute the corresponding captured-at lower bound in the user's local time

#### Scenario: Absolute date qualifier
- **WHEN** the input contains `after:2026-11-01` or `before:2026-11-22`
- **THEN** the parser SHALL apply the corresponding captured-at boundary

#### Scenario: Starred qualifier
- **WHEN** the input contains `starred` or `收藏`
- **THEN** the parser SHALL restrict results to starred files

### Requirement: Free-term matching semantics

The query SHALL require every non-negated free term to match at least one searchable field.

#### Scenario: Single free term
- **WHEN** the query contains one free term
- **THEN** a file SHALL match if its AI filename, tags, source URL/domain, or user notes contain that term

#### Scenario: Multiple free terms
- **WHEN** the query contains two free terms
- **THEN** a file SHALL match only if both terms match somewhere in its searchable fields
- **AND** the terms SHALL NOT need to match the same field

#### Scenario: Phrase term
- **WHEN** a free term is a quoted phrase
- **THEN** the phrase SHALL match as one contiguous substring across a searchable field

#### Scenario: Exclusion
- **WHEN** the query contains a negated term
- **THEN** files matching that term SHALL be excluded even if all positive terms match

#### Scenario: Combined with a qualifier
- **WHEN** the query contains both free terms and a known qualifier
- **THEN** the free-term match and the qualifier filter SHALL both apply

#### Scenario: Empty query
- **WHEN** the query is empty or contains only whitespace
- **THEN** no text constraint SHALL be applied
- **AND** the library SHALL show the unfiltered result set

### Requirement: Tag token semantics

Multiple tag tokens SHALL compose without a separate match-mode control.

#### Scenario: Repeated tag tokens mean AND
- **WHEN** the query contains `tag:猫 tag:壁纸`
- **THEN** the result SHALL contain only files that have both tags

#### Scenario: Pipe means OR
- **WHEN** the query contains `tag:猫|狗`
- **THEN** the result SHALL contain files that have either tag

#### Scenario: System tag
- **WHEN** the query targets a system tag such as `tag:image`, `tag:video`, or `tag:starred`
- **THEN** the query SHALL match the corresponding system tag form stored on the file

#### Scenario: Mixed tag expression
- **WHEN** the query combines an OR group and another tag token, such as `tag:猫|狗 tag:可爱`
- **THEN** the result SHALL contain files that match the OR group and also have `可爱`

#### Scenario: Remove one tag token
- **WHEN** the user removes one tag condition
- **THEN** the remaining tag conditions SHALL still apply
- **AND** pagination SHALL reset to the first page

### Requirement: Query suggestions

The search surface SHALL offer grouped suggestions while the user types.

#### Scenario: Tag suggestions
- **WHEN** the user types free text or `tag:` followed by text
- **THEN** the suggestion surface SHALL show matching tags with their usage counts
- **AND** pinned tags SHALL be identifiable

#### Scenario: Site suggestions
- **WHEN** the user types `site:` followed by text
- **THEN** the suggestion surface SHALL show matching source domains with their file counts

#### Scenario: Dimension suggestions
- **WHEN** the user types an incomplete qualifier such as `type:`, `status:`, `date:`, or `sta`
- **THEN** the suggestion surface SHALL show valid values for that dimension

#### Scenario: Recent search suggestions
- **WHEN** the user focuses an empty search bar and recent searches exist
- **THEN** the suggestion surface SHALL show recent searches

#### Scenario: Select a suggestion
- **WHEN** the user selects a suggestion
- **THEN** the corresponding token or value SHALL be inserted into the query
- **AND** the results SHALL refresh with the updated query

#### Scenario: Suggestions do not rewrite text
- **WHEN** the user types text that does not exactly match a suggestion
- **THEN** the system SHALL NOT silently replace the text with a suggested term or tag

#### Scenario: No suggestions
- **WHEN** no tag, site, dimension, or recent search matches the active token
- **THEN** the suggestion surface SHALL show the raw-term search action without inventing a correction

### Requirement: Query input behavior

The search input SHALL remain usable with Chinese input methods and keyboard-only navigation.

#### Scenario: IME composition
- **WHEN** the user is composing text with an input method
- **THEN** the system SHALL NOT run a query or change suggestions until composition ends

#### Scenario: Keyboard navigation
- **WHEN** the suggestion surface is open and the user presses ArrowUp or ArrowDown
- **THEN** the highlighted suggestion SHALL move accordingly

#### Scenario: Enter with a highlighted suggestion
- **WHEN** a suggestion is highlighted and the user presses Enter
- **THEN** the suggestion SHALL be applied

#### Scenario: Enter without a highlighted suggestion
- **WHEN** no suggestion is highlighted and the user presses Enter
- **THEN** the current raw query SHALL be searched

#### Scenario: Dismiss suggestions
- **WHEN** the user presses Escape
- **THEN** the suggestion surface SHALL close without discarding the query

#### Scenario: Focus shortcut
- **WHEN** the user presses `/` or Cmd/Ctrl+K outside a text field
- **THEN** focus SHALL move to the search input

### Requirement: Empty-state search recommendations

The Media Library SHALL recommend useful starting points when the search bar is empty or the result set has no matches.

#### Scenario: Empty search recommendations
- **WHEN** the search bar is focused and empty
- **THEN** the surface SHALL show recent searches, top tags, top source sites, and quick filters
- **AND** the recommendations SHALL be derived from existing local tag and source-domain data

#### Scenario: Apply a recommendation
- **WHEN** the user selects a recommended tag, site, recent search, or quick filter
- **THEN** the corresponding query text SHALL be applied
- **AND** the results SHALL refresh

#### Scenario: No matching results
- **WHEN** the current query returns no files
- **THEN** the empty state SHALL offer to remove one active condition, clear all conditions, or try a matching tag or site

#### Scenario: Clear recent searches
- **WHEN** the user clears recent searches
- **THEN** the stored recent-search entries SHALL be removed
- **AND** the empty-state recommendation list SHALL no longer show them
