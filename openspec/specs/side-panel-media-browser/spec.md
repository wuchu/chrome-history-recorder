# Side Panel Media Browser

## Purpose

Provide the Chrome Side Panel as the primary media capture and browsing UI, replacing the DevTools Panel as the main supported surface.

## Requirements

### Requirement: Chrome Side Panel entrypoint
The extension SHALL provide a Chrome Side Panel as the primary media capture and browsing UI.

#### Scenario: Open Side Panel from extension action
- **WHEN** the user clicks the extension action
- **THEN** Chrome SHALL open the Media Recorder Side Panel
- **AND** the Side Panel SHALL render the media browser UI for the current active tab

#### Scenario: Side Panel manifest wiring
- **WHEN** the extension is built with WXT
- **THEN** the generated manifest SHALL include a `side_panel.default_path` entry
- **AND** the extension SHALL request the `sidePanel` permission

#### Scenario: Current tab awareness
- **WHEN** the Side Panel initializes or the active tab changes
- **THEN** it SHALL request the active tab capture state from the Background Service Worker
- **AND** it SHALL display capture controls for that tab

### Requirement: Side Panel capture controls
The Side Panel SHALL allow users to start and stop capture for the active tab through Background runtime messages.

#### Scenario: Start active tab capture
- **WHEN** the user starts capture in the Side Panel
- **THEN** the Side Panel SHALL send a Background message containing the active tab id
- **AND** Background SHALL attempt to enable capture for that tab
- **AND** the Side Panel SHALL show the resulting capture state

#### Scenario: Stop active tab capture
- **WHEN** the user stops capture in the Side Panel
- **THEN** the Side Panel SHALL request Background to stop capture for the active tab
- **AND** Background SHALL detach any active capture backend for that tab
- **AND** the Side Panel SHALL show capture as paused or stopped

#### Scenario: Capture start failure
- **WHEN** Background cannot enable capture for the active tab
- **THEN** the Side Panel SHALL display an actionable error state
- **AND** it SHALL NOT present the tab as actively capturing

### Requirement: Side Panel media browsing
The Side Panel SHALL provide the primary media browsing experience using VFS-backed media records and thumbnails.

#### Scenario: Load historical media
- **WHEN** the Side Panel opens
- **THEN** it SHALL request historical media from Background using the supported `listFiles` message protocol
- **AND** it SHALL display returned media in a virtualized masonry grid

#### Scenario: Display real-time captures
- **WHEN** Background broadcasts a `file:captured` event
- **THEN** the Side Panel SHALL add the captured media to the live capture stream
- **AND** it SHALL merge the media into the grid without duplicating an existing hash

#### Scenario: Tag-filtered browsing
- **WHEN** the user selects a system or user tag in the Side Panel
- **THEN** the Side Panel SHALL filter historical and newly captured media by that tag
- **AND** it SHALL preserve pagination behavior for the selected filter

### Requirement: Side Panel service status
The Side Panel SHALL show capture, VFS, Ollama, and classification status for the active Extension Background runtime in a compact single-row layout.

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
- **WHEN** Background broadcasts service or scheduler status events
- **THEN** the Side Panel SHALL update the visible status without requiring a page refresh

#### Scenario: Show capture error as tooltip
- **WHEN** a capture error exists
- **THEN** the ❌ icon SHALL have a tooltip showing the error message
- **AND** the error text SHALL NOT be displayed inline in the status bar

### Requirement: Side Panel media details
The Side Panel SHALL provide a focused VFS-backed media detail view from the media grid.

#### Scenario: Open media detail
- **WHEN** the user clicks a media thumbnail
- **THEN** the Side Panel SHALL open a focused media detail view
- **AND** image previews SHALL use the local VFS file URL derived from the media hash

#### Scenario: Show media detail title
- **WHEN** the Side Panel media detail view opens
- **THEN** it SHALL display a top-left title
- **AND** the title SHALL prefer the AI-renamed filename
- **AND** the title SHALL fall back to the media hash when no renamed filename exists

#### Scenario: Detail viewer actions
- **WHEN** the Side Panel media detail view is shown
- **THEN** it SHALL provide a close action
- **AND** it SHALL NOT show download, rotate, or requeue-style toolbar icons in the focused original-image viewer

### Requirement: Side Panel settings handoff
The Side Panel SHALL link to the dedicated Options page for program configuration.

#### Scenario: Open Options page
- **WHEN** the user invokes settings from the Side Panel
- **THEN** the extension SHALL open the existing Options page
- **AND** the Side Panel SHALL NOT embed full Ollama, queue maintenance, or filename-style configuration forms

### Requirement: Fixed top bar with frosted glass effect
The Side Panel SHALL fix the top bar and all components above it to the viewport top with a frosted glass background effect.

#### Scenario: Top area stays fixed when scrolling
- **WHEN** the user scrolls the media grid
- **THEN** the StatusBar, CaptureStream (if visible), ClassifyProgressSection, and ScrollableTabBar SHALL remain fixed at the top of the viewport
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
