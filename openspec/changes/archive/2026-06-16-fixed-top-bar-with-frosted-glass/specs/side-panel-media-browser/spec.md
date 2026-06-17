## ADDED Requirements

### Requirement: Fixed top bar with frosted glass effect
The Side Panel SHALL fix the top bar and all components above it to the viewport top with a frosted glass background effect.

#### Scenario: Top area stays fixed when scrolling
- **WHEN** the user scrolls the media grid
- **THEN** the StatusBar, toolbar, CaptureStream (if visible), ClassifyProgressSection, and ScrollableTabBar SHALL remain fixed at the top of the viewport
- **AND** they SHALL NOT scroll with the media content

#### Scenario: Frosted glass background effect
- **WHEN** the top area is fixed
- **THEN** it SHALL have a semi-transparent background with a backdrop blur (frosted glass) effect
- **AND** the effect SHALL adapt to light/dark theme

#### Scenario: No horizontal scrollbar
- **WHEN** the Side Panel is rendered at any width
- **THEN** no horizontal scrollbar SHALL appear on the page
