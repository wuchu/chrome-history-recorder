## MODIFIED Requirements

### Requirement: Side Panel service status
The Side Panel SHALL show capture, VFS, Ollama, and classification status for the active Extension Background runtime.

#### Scenario: Show runtime service status
- **WHEN** the Side Panel renders its status area
- **THEN** it SHALL show whether VFS is connected
- **AND** it SHALL show whether Ollama is available
- **AND** VFS and Ollama connection indicators SHALL use consistently sized status dots
- **AND** it SHALL show whether capture is active for the current tab

#### Scenario: Status updates from Background events
- **WHEN** Background broadcasts service or scheduler status events
- **THEN** the Side Panel SHALL update the visible status without requiring a page refresh

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

