## MODIFIED Requirements

### Requirement: Dedicated extension options page
The extension SHALL provide a dedicated Options page for active program configuration.

#### Scenario: Open extension options
- **WHEN** the user opens the extension Options page
- **THEN** the system SHALL render a configuration UI for the active Extension Background + VFS runtime
- **AND** the UI SHALL be available as the extension options entrypoint

#### Scenario: Use Ant Design components
- **WHEN** the Options page renders configuration controls or feedback
- **THEN** the UI SHALL use Ant Design components for forms, cards, buttons, selectors, switches, status indicators, feedback messages, and confirmation dialogs
- **AND** extension UI code SHALL NOT use native `window.alert` or `alert` for user-facing feedback

