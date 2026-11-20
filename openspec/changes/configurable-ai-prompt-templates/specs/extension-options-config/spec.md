## ADDED Requirements

### Requirement: Prompt templates settings section
The Options page SHALL provide a section for editing AI prompt templates.

#### Scenario: Show editable templates
- **WHEN** the Options page renders the prompt templates section
- **THEN** it SHALL show one text area per prompt type (`classify`, `rename`, `translate`)
- **AND** each text area SHALL display its current value, defaulting to the built-in default when unset

#### Scenario: Persist a template edit
- **WHEN** the user saves a template
- **THEN** the Options page SHALL persist the change through a Background configuration update message
- **AND** the Background service worker SHALL apply the template to future AI requests

#### Scenario: Show placeholder help
- **WHEN** the Options page displays a template editor
- **THEN** it SHALL show which placeholders the template supports

#### Scenario: Restore a template default
- **WHEN** the user restores a template to default
- **THEN** the Options page SHALL clear the stored override and display the built-in default

#### Scenario: Empty template is valid
- **WHEN** the user clears a template and saves
- **THEN** the Options page SHALL persist the empty value
- **AND** the system SHALL use the built-in default for future requests

## REMOVED Requirements

### Requirement: Filename style settings section
**Reason**: The filename style selector and its custom-prompt override are removed; the naming style is now authored directly inside the editable rename prompt template.
**Migration**: Configure the desired naming style by editing the rename template in the new "AI 提示词模板" section.

