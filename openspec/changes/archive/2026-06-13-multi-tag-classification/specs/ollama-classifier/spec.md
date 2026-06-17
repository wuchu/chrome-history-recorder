## MODIFIED Requirements

### Requirement: Classification output
The system SHALL produce structured classification results.

#### Scenario: Return classification data
- **WHEN** classification is complete
- **THEN** the system SHALL return JSON with tags (array), suggestedName, and confidence
- **AND** the category field SHALL be deprecated but still returned for backward compatibility

## ADDED Requirements

### Requirement: Tag-aware classification prompt
The system SHALL use user-defined tags in the classification prompt.

#### Scenario: Include available tags in prompt
- **WHEN** building the classification prompt
- **THEN** the system SHALL include the list of user-defined tags as "Available tags"
- **AND** the prompt SHALL instruct the AI to select 1-3 tags from the list

#### Scenario: Prompt format with tags
- **WHEN** the prompt is generated for Chinese
- **THEN** the format SHALL be: "标签1,标签2 | 文件名"
- **WHEN** the prompt is generated for English
- **THEN** the format SHALL be: "TAG1,TAG2 | FILENAME"

### Requirement: Multi-tag selection from predefined set
The system SHALL select tags from the user-defined tag set.

#### Scenario: Parse comma-separated tags
- **WHEN** parsing the AI classification result
- **THEN** the system SHALL split the tag portion by commas
- **AND** the system SHALL trim whitespace from each tag
- **AND** the system SHALL filter out tags not in the user-defined set
- **AND** the system SHALL limit to maximum 3 tags

#### Scenario: Fallback for invalid tags
- **WHEN** AI returns tags not in the user-defined set
- **THEN** the system SHALL ignore invalid tags
- **AND** if no valid tags remain, the system MAY leave user_tags empty
