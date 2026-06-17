## ADDED Requirements

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
The Side Panel SHALL show capture, VFS, Ollama, and classification status for the active Extension Background runtime.

#### Scenario: Show runtime service status
- **WHEN** the Side Panel renders its status area
- **THEN** it SHALL show whether VFS is connected
- **AND** it SHALL show whether Ollama is available
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

#### Scenario: Requeue media from detail
- **WHEN** the user requests reclassification or AI filename regeneration from the detail view
- **THEN** the Side Panel SHALL send the media hash to Background for requeue
- **AND** it SHALL show pending feedback while the request is in progress

### Requirement: Side Panel settings handoff
The Side Panel SHALL link to the dedicated Options page for program configuration.

#### Scenario: Open Options page
- **WHEN** the user invokes settings from the Side Panel
- **THEN** the extension SHALL open the existing Options page
- **AND** the Side Panel SHALL NOT embed full Ollama, queue maintenance, or filename-style configuration forms
