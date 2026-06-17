## ADDED Requirements

### Requirement: DevTools media grid superseded by Side Panel
The DevTools media grid SHALL no longer be the primary supported media capture and browsing surface after the Side Panel migration.

#### Scenario: Primary media browser location
- **WHEN** the user opens the extension for media capture or browsing
- **THEN** the system SHALL present the Side Panel media browser as the primary UI
- **AND** documentation SHALL NOT require opening Chrome DevTools to use the recorder

#### Scenario: Temporary DevTools compatibility
- **WHEN** DevTools media grid code remains during migration
- **THEN** it SHALL be treated as a temporary fallback or debugging surface
- **AND** new primary media browser requirements SHALL be defined by `side-panel-media-browser`

### Requirement: DevTools-specific network capture retired
The DevTools media grid SHALL NOT own image interception after migration to Side Panel capture.

#### Scenario: Capture toggle behavior
- **WHEN** the user starts capture from the supported UI
- **THEN** the request SHALL be handled by Background tab-scoped capture state
- **AND** the system SHALL NOT depend on `chrome.devtools.network.onRequestFinished` for primary capture

