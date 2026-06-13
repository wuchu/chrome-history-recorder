## ADDED Requirements

### Requirement: DevTools configuration focuses on active runtime controls
The DevTools Panel SHALL expose only configuration controls that operate the current Extension Background and VFS Service workflow.

#### Scenario: Render supported configuration controls
- **WHEN** the DevTools Panel renders its configuration area
- **THEN** it SHALL show service status, Ollama model configuration, and AI classification controls that are backed by Extension Background messages
- **AND** it SHALL NOT show legacy proxy endpoint or standalone CLI configuration controls

#### Scenario: Remove storage path form from DevTools
- **WHEN** the DevTools Panel renders configuration controls
- **THEN** it SHALL NOT render a storage path text input or save button that posts to the retired proxy HTTP endpoint

### Requirement: Capture defaults remain stable without filter forms
The system SHALL preserve existing capture defaults when low-frequency capture filter form controls are removed from the DevTools Panel.

#### Scenario: Initialize image capture threshold
- **WHEN** the DevTools Panel starts network capture
- **THEN** it SHALL use the configured or default minimum image size threshold without requiring a visible form input

#### Scenario: Initialize video capture filters
- **WHEN** the DevTools Panel starts network capture
- **THEN** it SHALL use the configured or default minimum video size and enabled video MIME types without requiring visible form inputs

### Requirement: Theme behavior does not require a visible form
The DevTools Panel SHALL remain readable in light and dark environments without requiring a prominent theme configuration form.

#### Scenario: Follow default theme behavior
- **WHEN** the user opens DevTools Panel after the configuration simplification
- **THEN** the panel SHALL apply the existing saved theme mode or automatic system theme behavior
- **AND** the simplified UI SHALL NOT require the user to choose a theme before using capture or classification features
