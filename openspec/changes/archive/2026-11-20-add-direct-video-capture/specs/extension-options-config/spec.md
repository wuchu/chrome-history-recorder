## ADDED Requirements

### Requirement: Video capture settings section

The Options page SHALL provide a video capture settings section for the active capture runtime.

#### Scenario: Toggle video capture
- **WHEN** the user enables or disables video capture
- **THEN** the system persists the setting to extension configuration
- **AND** the active capture runtime immediately starts or stops treating video responses as download candidates

#### Scenario: Configure maximum video size
- **WHEN** the user sets a maximum video size
- **THEN** the system persists the value to extension configuration
- **AND** video candidates larger than the new value are skipped

#### Scenario: Select enabled video formats
- **WHEN** the user selects the video formats to capture
- **THEN** the system persists the selected MIME types to extension configuration
- **AND** the active capture runtime only records candidates matching the selected formats

#### Scenario: Reject invalid maximum size
- **WHEN** the user enters a maximum video size outside the supported range or not a number
- **THEN** the Options page shows a validation error
- **AND** the invalid value is not persisted

#### Scenario: Default video settings
- **WHEN** the Options page loads with no saved video settings
- **THEN** it displays video capture enabled, a maximum size of 200 MiB, and MP4 and WebM selected
