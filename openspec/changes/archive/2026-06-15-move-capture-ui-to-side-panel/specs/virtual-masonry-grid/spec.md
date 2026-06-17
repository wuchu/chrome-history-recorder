## ADDED Requirements

### Requirement: Side Panel host compatibility
The virtual masonry grid SHALL support rendering inside the Chrome Side Panel media browser.

#### Scenario: Render in narrow Side Panel viewport
- **WHEN** the virtual masonry grid is rendered inside the Side Panel
- **THEN** it SHALL support a one-column layout when the panel is narrow
- **AND** it SHALL preserve lazy-loaded thumbnails and stable item click behavior

#### Scenario: Receive Background runtime media events
- **WHEN** new media and classification status arrive through Background runtime messages
- **THEN** the grid data layer SHALL merge events by media hash
- **AND** it SHALL avoid duplicate items across historical and real-time sources

### Requirement: UI-surface-agnostic media browser components
The masonry grid and media detail components SHALL avoid direct dependencies on DevTools-only APIs.

#### Scenario: Component reuse outside DevTools
- **WHEN** the Side Panel imports media browser components
- **THEN** those components SHALL render using props and runtime-message-backed data
- **AND** they SHALL NOT call `chrome.devtools.*` APIs directly

