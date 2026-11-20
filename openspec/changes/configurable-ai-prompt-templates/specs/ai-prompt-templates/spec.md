## ADDED Requirements

### Requirement: Prompt template storage
The system SHALL store AI prompt templates as part of extension configuration, with one template per prompt type (`classify`, `rename`).

#### Scenario: Templates are optional
- **WHEN** extension configuration is loaded
- **THEN** the system SHALL treat an absent, empty, or whitespace-only template value as unset

#### Scenario: Templates persist across restarts
- **WHEN** the user saves a template
- **THEN** the system SHALL persist it with the rest of extension configuration and apply it to future AI requests

### Requirement: Placeholder substitution
The system SHALL substitute `{{placeholder}}` variables into prompt templates before sending them to the model.

#### Scenario: Substitute classify placeholder
- **WHEN** the classify template contains `{{vocabulary}}`
- **THEN** the system SHALL replace it with the bounded tag vocabulary block

#### Scenario: Unknown placeholders are preserved
- **WHEN** a template contains a placeholder that has no matching value
- **THEN** the system SHALL leave the placeholder text unchanged rather than failing

### Requirement: Built-in defaults and fallback
The system SHALL provide a built-in default template for each prompt type and use it when a template is unset.

#### Scenario: Use default when unset
- **WHEN** a prompt type has no user template
- **THEN** the system SHALL use the built-in default template for that prompt type

#### Scenario: Defaults are recoverable
- **WHEN** the user restores a template to its default
- **THEN** the system SHALL clear the stored override so the built-in default applies

### Requirement: Template reset
The system SHALL allow the user to restore each prompt template to its built-in default from the Options page.

#### Scenario: Reset a template
- **WHEN** the user triggers reset for a template
- **THEN** the system SHALL clear the stored value and display the built-in default
