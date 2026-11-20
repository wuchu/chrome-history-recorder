# Dark Mode Support

## Purpose

Enable automatic theme detection and manual theme switching across extension UI surfaces, including the Options page, providing proper styling for both dark and light modes.

## Requirements

### Requirement: Theme detection
The system SHALL detect the active extension UI surface theme automatically, including the Options page.

#### Scenario: Detect dark theme
- **WHEN** the browser or system is using dark theme
- **THEN** the Options page SHALL apply dark mode styles

#### Scenario: Detect light theme
- **WHEN** the browser or system is using light theme
- **THEN** the Options page SHALL apply light mode styles

#### Scenario: Theme change
- **WHEN** the system theme changes
- **THEN** the Options page SHALL immediately update its theme

### Requirement: Manual theme switching
The system SHALL allow users to manually override the theme, including on the Options page.

#### Scenario: Force dark mode
- **WHEN** the user selects the "Dark" theme option
- **THEN** the system SHALL apply dark mode regardless of the system theme

#### Scenario: Force light mode
- **WHEN** the user selects the "Light" theme option
- **THEN** the system SHALL apply light mode regardless of the system theme

#### Scenario: Auto mode
- **WHEN** the user selects the "Auto" theme option
- **THEN** the system SHALL follow the system theme

#### Scenario: Persist theme preference
- **WHEN** the user selects a theme
- **THEN** the system SHALL save the preference to Chrome Storage
- **AND** the preference SHALL persist across sessions
- **AND** the Side Panel and Options page SHALL share the same saved preference

### Requirement: Theme styling
The system SHALL provide complete styling for both themes on the Options page.

#### Scenario: Dark mode colors
- **WHEN** dark mode is active on the Options page
- **THEN** the background SHALL be dark (#1e1e1e or similar)
- **AND** text SHALL be light (#e0e0e0 or similar)
- **AND** accent colors SHALL be visible on the dark background

#### Scenario: Light mode colors
- **WHEN** light mode is active on the Options page
- **THEN** the background SHALL be light (#f5f5f5 or similar)
- **AND** text SHALL be dark (#333333 or similar)
- **AND** accent colors SHALL be visible on the light background

#### Scenario: Apply theme via Ant Design algorithm and CSS variables
- **WHEN** the theme changes on the Options page
- **THEN** the Options page SHALL apply the Ant Design dark algorithm
- **AND** it SHALL update its CSS variables or background styles accordingly
