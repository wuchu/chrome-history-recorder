## MODIFIED Requirements

### Requirement: Tag-aware classification prompt
The system SHALL build the classification prompt from a user-editable template that injects the AI-owned tag vocabulary, falling back to a built-in default when no template is set.

#### Scenario: Include available tags in prompt
- **WHEN** building the classification prompt
- **THEN** the system SHALL substitute the bounded top-N list of existing vocabulary tags into the `{{vocabulary}}` placeholder
- **AND** the prompt SHALL instruct the model to reuse an existing tag when it is a near-synonym and to mark genuinely new concepts as new tags

#### Scenario: Prompt format with tags
- **WHEN** the prompt is generated
- **THEN** it SHALL define an unambiguous output format for tags, including a marker for new tags
- **AND** it SHALL NOT restrict the model to only predefined tags

#### Scenario: Use user template when set
- **WHEN** a user-supplied classification template is configured
- **THEN** the system SHALL build the prompt from that template after placeholder substitution

#### Scenario: Fall back to default template
- **WHEN** no classification template is configured
- **THEN** the system SHALL build the prompt from the built-in default template
