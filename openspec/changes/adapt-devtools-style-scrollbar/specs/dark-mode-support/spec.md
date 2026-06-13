## MODIFIED Requirements

### Requirement: Theme styling
The system SHALL provide complete styling for both themes.

#### Scenario: Dark mode colors
- **WHEN** dark mode is active
- **THEN** background SHALL be dark (#1e1e1e or similar)
- **AND** text SHALL be light (#e0e0e0 or similar)
- **AND** accent colors SHALL be visible on dark background
- **AND** scrollbar SHALL use dark theme colors (track #2d2d30, thumb #5a5a5a)

#### Scenario: Light mode colors
- **WHEN** light mode is active
- **THEN** background SHALL be light (#f5f5f5 or similar)
- **AND** text SHALL be dark (#333333 or similar)
- **AND** accent colors SHALL be visible on light background
- **AND** scrollbar SHALL use light theme colors (track #f1f1f1, thumb #c1c1c1)

#### Scenario: CSS variables
- **WHEN** theme changes
- **THEN** CSS variables SHALL update accordingly
