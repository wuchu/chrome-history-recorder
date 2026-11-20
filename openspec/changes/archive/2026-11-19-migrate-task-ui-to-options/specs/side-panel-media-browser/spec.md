## MODIFIED Requirements

### Requirement: Side Panel service status
The Side Panel SHALL show capture, VFS, and Ollama status for the active Extension Background runtime in a compact single-row layout.

#### Scenario: Show runtime service status
- **WHEN** the Side Panel renders its status area
- **THEN** it SHALL show whether VFS is connected with a status dot and the text "VFS"
- **AND** it SHALL show whether Ollama is available with a status dot and the text "Ollama"
- **AND** it SHALL show the service status with a status dot and the text "服务"
- **AND** it SHALL show capture success count as ✅N and failure count as ❌N
- **AND** VFS and Ollama connection indicators SHALL use consistently sized status dots
- **AND** it SHALL show whether capture is active for the current tab
- **AND** status information SHALL be grouped with vertical bar separators for visual clarity

#### Scenario: Status updates from Background events
- **WHEN** Background broadcasts service status events
- **THEN** the Side Panel SHALL update the visible status without requiring a page refresh

#### Scenario: Show capture error as tooltip
- **WHEN** a capture error exists
- **THEN** the ❌ icon SHALL have a tooltip showing the error message
- **AND** the error text SHALL NOT be displayed inline in the status bar

### Requirement: Fixed top bar with frosted glass effect
The Side Panel SHALL fix the top bar and all components above it to the viewport top with a frosted glass background effect.

#### Scenario: Top area stays fixed when scrolling
- **WHEN** the user scrolls the media grid
- **THEN** the StatusBar, CaptureStream (if visible), and ScrollableTabBar SHALL remain fixed at the top of the viewport
- **AND** they SHALL NOT scroll with the media content

#### Scenario: Frosted glass background effect
- **WHEN** the top area is fixed
- **THEN** it SHALL have a semi-transparent background with a backdrop blur (frosted glass) effect
- **AND** the effect SHALL adapt to light/dark theme

#### Scenario: No horizontal scrollbar
- **WHEN** the Side Panel is rendered at any width
- **THEN** no horizontal scrollbar SHALL appear on the page

#### Scenario: Dynamic content padding
- **WHEN** the top fixed area's height changes (due to window resize or content visibility changes)
- **THEN** the main content area's top padding SHALL adjust automatically to match the new height
- **AND** content SHALL NOT be obscured or have unnecessary extra padding
