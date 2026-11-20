## MODIFIED Requirements

### Requirement: Rename naming style
The system SHALL build the rename prompt from a user-editable template that contains the naming style inline, and apply the result to generated display filenames.

#### Scenario: Style baked into template
- **WHEN** a rename task generates a filename
- **THEN** the prompt SHALL be built from the configured rename template, whose naming style is written directly into the template text
- **AND** the resulting filename SHALL be sanitized for display

#### Scenario: Use user template when set
- **WHEN** a user-supplied rename template is configured
- **THEN** the system SHALL build the prompt from that template

#### Scenario: Fall back to default template
- **WHEN** no rename template is configured
- **THEN** the system SHALL build the prompt from the built-in default template

#### Scenario: Empty or invalid model output
- **WHEN** the model returns an empty or unusable filename
- **THEN** the system SHALL keep the existing display filename or fall back to the media hash
- **AND** it SHALL record the failure for retry or diagnostics
