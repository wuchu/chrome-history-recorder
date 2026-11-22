## MODIFIED Requirements

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

#### Scenario: Select default capture mode
- **WHEN** the user selects `re-download` or `buffer-only` as the default video capture mode
- **THEN** the system persists the value to extension configuration
- **AND** pages without a host override use the new mode

#### Scenario: Configure per-host capture mode overrides
- **WHEN** the user edits the host override list in the form `host=mode`
- **THEN** the system persists the normalized host suffixes and modes to extension configuration
- **AND** invalid hosts or modes are rejected with a visible error

#### Scenario: Toggle optional gap filling
- **WHEN** the user enables or disables "补齐缺失区间"
- **THEN** the system persists `videoAssemblyFillGaps` to extension configuration
- **AND** the section explains that it issues additional Range requests for missing bytes
- **AND** the default is enabled and the user can turn it off

#### Scenario: Reject invalid maximum size
- **WHEN** the user enters a maximum video size outside the supported range or not a number
- **THEN** the Options page shows a validation error
- **AND** the invalid value is not persisted

#### Scenario: Default video settings
- **WHEN** the Options page loads with no saved video settings
- **THEN** it displays video capture enabled, a maximum size of 200 MiB, MP4 and WebM selected, the global `re-download` mode, and gap filling enabled
