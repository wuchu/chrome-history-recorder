# Side Panel Capture Cockpit

## Purpose

Provide the Chrome Side Panel as the primary capture monitoring and control cockpit for the active tab. The global media library lives in the Options media library capability.

## Requirements

### Requirement: Chrome Side Panel entrypoint
The extension SHALL provide a Chrome Side Panel as the primary capture monitoring and control UI for the active tab.

#### Scenario: Open Side Panel from extension action
- **WHEN** the user clicks the extension action
- **THEN** Chrome SHALL open the Media Recorder Side Panel
- **AND** the Side Panel SHALL render the capture cockpit for the current active tab

#### Scenario: Side Panel manifest wiring
- **WHEN** the extension is built with WXT
- **THEN** the generated manifest SHALL include a `side_panel.default_path` entry
- **AND** the extension SHALL request the `sidePanel` permission

#### Scenario: Current tab awareness
- **WHEN** the Side Panel initializes or the active tab changes
- **THEN** it SHALL request the active tab identity and capture session snapshot from the Background Service Worker
- **AND** it SHALL display the active tab's capture state and session state

#### Scenario: Unsupported page
- **WHEN** the active tab cannot be captured by the extension
- **THEN** the Side Panel SHALL show an unsupported-page state with the reason
- **AND** it SHALL NOT present a usable capture start action

### Requirement: Side Panel capture controls
The Side Panel SHALL allow users to start and stop the single capture session for the active tab through Background runtime messages.

#### Scenario: Start capture with no active session
- **WHEN** no session is active and the user starts capture in the Side Panel
- **THEN** the Side Panel SHALL send a Background message to start capture for the active tab
- **AND** the Side Panel SHALL display the resulting session state

#### Scenario: Start capture while another tab is capturing
- **WHEN** a session is active for another tab and the user starts capture from the current tab
- **THEN** the Side Panel SHALL show a confirmation dialog naming the other tab
- **AND** confirmation SHALL stop the other session and start a new session for the current tab
- **AND** cancellation SHALL leave the other session running

#### Scenario: Stop capture from the session tab
- **WHEN** the user stops capture on the session tab
- **THEN** the Side Panel SHALL request that the Background stop the session
- **AND** the Side Panel SHALL show the session summary after the session ends

#### Scenario: Stop capture from another tab
- **WHEN** the session is active in another tab and the user requests stop from the current tab
- **THEN** the Side Panel SHALL stop the session in the other tab
- **AND** it SHALL return the current tab to the no-session state

#### Scenario: Capture start failure
- **WHEN** the Background cannot start capture for the active tab
- **THEN** the Side Panel SHALL display an actionable error state
- **AND** it SHALL NOT present the tab as actively capturing

### Requirement: Side Panel service status
The Side Panel SHALL show capture, VFS, and Ollama status for the active Extension Background runtime in a compact single-row layout.

#### Scenario: Show runtime service status
- **WHEN** the Side Panel renders its status area
- **THEN** it SHALL show whether VFS is connected with a status dot and the text "VFS"
- **AND** it SHALL show whether Ollama is available with a status dot and the text "Ollama"
- **AND** it SHALL show the service status with a status dot and the text "服务"
- **AND** VFS and Ollama connection indicators SHALL use consistently sized status dots
- **AND** status information SHALL be grouped with vertical bar separators for visual clarity

#### Scenario: Show session status
- **WHEN** a capture session is active
- **THEN** the Side Panel SHALL show that capture is active
- **AND** it SHALL show whether the session belongs to the current tab or another tab
- **AND** it SHALL show the session's saved and failed counts rather than global capture totals

#### Scenario: Status updates from Background events
- **WHEN** Background broadcasts service or session status events
- **THEN** the Side Panel SHALL update the visible status without requiring a page refresh

#### Scenario: Show capture error as tooltip
- **WHEN** a capture error exists
- **THEN** the error indicator SHALL have a tooltip showing the error message
- **AND** the error text SHALL NOT be displayed inline in the status bar

### Requirement: Side Panel settings handoff
The Side Panel SHALL link to the Options console for configuration and global media management.

#### Scenario: Open Settings
- **WHEN** the user invokes settings from the Side Panel
- **THEN** the extension SHALL open the Options page on the Settings tab
- **AND** the Side Panel SHALL NOT embed full Ollama, queue maintenance, or filename-style configuration forms

#### Scenario: Open Media Library
- **WHEN** the user invokes the media library from the Side Panel
- **THEN** the extension SHALL open the Options page on the Media Library tab
- **AND** the Side Panel SHALL NOT embed the global historical media grid

### Requirement: Fixed top bar with frosted glass effect
The Side Panel SHALL fix the tab identity, capture controls, session banner, and session metrics to the viewport top with a frosted glass background effect.

#### Scenario: Cockpit header stays fixed when scrolling
- **WHEN** the user scrolls the session live feed or event log
- **THEN** the tab identity, capture controls, session banner, and session metrics SHALL remain fixed at the top of the viewport
- **AND** they SHALL NOT scroll with the feed content

#### Scenario: Frosted glass background effect
- **WHEN** the cockpit header is fixed
- **THEN** it SHALL have a semi-transparent background with a backdrop blur (frosted glass) effect
- **AND** the effect SHALL adapt to light and dark themes

#### Scenario: No horizontal scrollbar
- **WHEN** the Side Panel is rendered at any width
- **THEN** no horizontal scrollbar SHALL appear on the page

#### Scenario: Dynamic content padding
- **WHEN** the fixed header height changes due to window resize or session state changes
- **THEN** the content area's top padding SHALL adjust automatically to match the new height
- **AND** content SHALL NOT be obscured or have unnecessary extra padding

### Requirement: Active tab identity
The Side Panel SHALL display the identity of the active tab.

#### Scenario: Show tab identity
- **WHEN** the Side Panel renders an active tab
- **THEN** it SHALL show the tab favicon, page title, hostname, and current page URL
- **AND** the full URL SHALL be available to view and copy

#### Scenario: Update identity on tab change
- **WHEN** the active tab changes
- **THEN** the Side Panel SHALL update the favicon, title, hostname, and URL without a full reload

#### Scenario: Update identity on in-tab navigation
- **WHEN** the active tab navigates to another page
- **THEN** the Side Panel SHALL update the title and URL for the new page

#### Scenario: Unsupported page identity
- **WHEN** the active tab is not capturable
- **THEN** the Side Panel SHALL show the page identity together with an explanation that capture is unavailable

### Requirement: Session state presentation
The Side Panel SHALL present the relationship between the active tab and the single capture session.

#### Scenario: Session on the active tab
- **WHEN** the active tab owns the active session
- **THEN** the Side Panel SHALL render the full capture cockpit for that tab

#### Scenario: Session on another tab
- **WHEN** the active tab does not own the active session and a session is active elsewhere
- **THEN** the Side Panel SHALL show a banner naming the session tab and its saved count
- **AND** the banner SHALL provide actions to switch to the session tab or stop the session
- **AND** the Side Panel SHALL NOT present the active tab as capturing

#### Scenario: Session ended on the active tab
- **WHEN** the active tab owns a stopped session
- **THEN** the Side Panel SHALL show the session summary for that session
- **AND** it SHALL provide an action to start a new session

#### Scenario: No session
- **WHEN** no session is active or retained for the active tab
- **THEN** the Side Panel SHALL show the active tab identity and a start-capture action

### Requirement: Session metrics strip
The Side Panel SHALL show metrics scoped to the active session.

#### Scenario: Show session counters
- **WHEN** the session cockpit renders
- **THEN** it SHALL show saved, duplicate, skipped, and failed counts
- **AND** it SHALL show saved images, saved videos, and saved bytes
- **AND** it SHALL show AI pending and AI completed counts for session items

#### Scenario: Counters update live
- **WHEN** a session-scoped capture, video, or AI event arrives
- **THEN** the corresponding metric SHALL update without a page refresh

#### Scenario: No global totals
- **WHEN** the metrics strip renders
- **THEN** it SHALL NOT show global library totals or counts from files outside the session

### Requirement: Session live capture feed
The Side Panel SHALL show a live feed of media saved during the active session.

#### Scenario: Show recent session items
- **WHEN** the session cockpit renders
- **THEN** it SHALL show the most recent saved items from the session, newest first
- **AND** each item SHALL show a thumbnail, media type, size, capture time, and AI status when available

#### Scenario: Show duplicate events
- **WHEN** the session records a duplicate capture
- **THEN** the live feed SHALL show a duplicate placeholder rather than omitting the event

#### Scenario: Do not steal scroll position
- **WHEN** new items arrive while the user is inspecting the feed
- **THEN** the Side Panel SHALL NOT jump the user's scroll position
- **AND** it SHALL indicate that new items are available

#### Scenario: Open the original file
- **WHEN** the user activates a saved item in the feed
- **THEN** the Side Panel SHALL open the original file from the local VFS in a new browser tab

#### Scenario: Pause and resume the feed
- **WHEN** the user pauses the live feed
- **THEN** new items SHALL be counted but SHALL NOT be inserted until the feed resumes

### Requirement: Expandable session event log
The Side Panel SHALL provide a real-time event log for the active session that is collapsed by default.

#### Scenario: Collapsed summary
- **WHEN** the cockpit renders
- **THEN** the event log SHALL show a compact summary of recent skip and failure counts
- **AND** the full log SHALL remain hidden until expanded

#### Scenario: Expand and filter
- **WHEN** the user expands the event log
- **THEN** the Side Panel SHALL show recent session events, newest first
- **AND** it SHALL allow filtering by event type including saved, duplicate, skipped, failed, video, and AI

#### Scenario: Event log entry content
- **WHEN** an event is displayed
- **THEN** it SHALL show the time, event type, a human-readable summary, and any available reason or source URL
- **AND** the source URL SHALL be copyable

#### Scenario: Pause the log view
- **WHEN** the user pauses the log view
- **THEN** the visible entries SHALL stop updating while the session continues capturing

#### Scenario: Clear the log
- **WHEN** the user clears the event log
- **THEN** the Side Panel SHALL show an empty log
- **AND** the session SHALL remain active with unchanged counters

### Requirement: Session summary and restart
The Side Panel SHALL show a summary when the session stops.

#### Scenario: Show session summary
- **WHEN** the active session stops
- **THEN** the Side Panel SHALL show the session duration, saved, duplicate, skipped, and failed counts, saved bytes, image and video counts, and the most frequent skip or failure reasons

#### Scenario: Restart from the summary
- **WHEN** the user starts capture from a stopped-session summary for the active tab
- **THEN** the Side Panel SHALL start a new session
- **AND** the previous summary SHALL be replaced

#### Scenario: Open the Media Library from the summary
- **WHEN** the user requests the global library from the summary
- **THEN** the Side Panel SHALL open the Options Media Library tab

### Requirement: No global media library in Side Panel
The Side Panel SHALL NOT render the global media library.

#### Scenario: No global historical grid
- **WHEN** the Side Panel renders
- **THEN** it SHALL NOT show the global historical masonry grid
- **AND** it SHALL NOT show global tag filter tabs

#### Scenario: Only session media is shown
- **WHEN** the VFS contains many files from previous sessions
- **THEN** the Side Panel SHALL show only media and events belonging to the active or most recently stopped session

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
- **AND** it SHALL provide a delete action
- **AND** it SHALL NOT show download, rotate, or requeue-style toolbar icons in the focused original-image viewer

#### Scenario: Delete media from detail view
- **WHEN** the user clicks the delete button in the media detail view
- **THEN** the Side Panel SHALL show a confirmation dialog explaining that the item moves to the trash
- **AND** upon confirmation, the Side Panel SHALL send a `trashFile` message to Background
- **AND** upon successful deletion, the media detail view SHALL close
- **AND** the deleted item SHALL be removed from the media grid

### Requirement: Media grid item delete button
The Side Panel SHALL provide a delete button on each media grid item for quick deletion.

#### Scenario: Delete button visibility on hover
- **WHEN** the user hovers over a media grid item
- **THEN** a delete button SHALL appear in the top-right corner of the item

#### Scenario: Delete button click prevents opening detail
- **WHEN** the user clicks the delete button on a media grid item
- **THEN** the media detail view SHALL NOT open
- **AND** the Side Panel SHALL show a confirmation dialog

#### Scenario: Delete media from grid
- **WHEN** the user confirms deletion from the grid item
- **THEN** the Side Panel SHALL send a `trashFile` message to Background
- **AND** upon successful deletion, the deleted item SHALL be removed from the media grid

### Requirement: Handle file deletion events
The Side Panel SHALL listen for `file:trashed` events from Background and update the UI accordingly.

#### Scenario: Remove deleted item from grid
- **WHEN** the Side Panel receives a `file:trashed` event from Background
- **THEN** the deleted item SHALL be removed from the media grid
- **AND** the media detail view SHALL close if it was showing the deleted item

#### Scenario: Restore a trashed item
- **WHEN** the Side Panel receives a `file:restored` event from Background
- **THEN** the restored item SHALL be available to the media grid again
- **AND** the Side Panel SHALL NOT need a full reload

### Requirement: Side Panel page scan action

The Side Panel SHALL provide a user-initiated "抓取本页" action for the active tab.

#### Scenario: Action availability
- **WHEN** the Side Panel renders in any state
- **THEN** it SHALL show the 抓取本页媒体 action as a top-right icon
- **AND** the action SHALL be available in both the start state and an active cockpit
- **AND** it SHALL NOT be duplicated as a text button in the start card

#### Scenario: Start a scan
- **WHEN** the user clicks 抓取本页
- **THEN** the Side Panel SHALL request a scan of the active tab
- **AND** it SHALL show a loading state while the scan runs

#### Scenario: Preview candidates
- **WHEN** the scan returns candidates
- **THEN** the Side Panel SHALL open a preview modal with the candidate list
- **AND** each candidate SHALL show a thumbnail, known dimensions, known size, and source kind
- **AND** the modal SHALL show the selected count and the total count

#### Scenario: Select and save
- **WHEN** the user toggles candidates and chooses to save
- **THEN** the Side Panel SHALL save only the selected candidates
- **AND** it SHALL show per-item progress and a final saved / duplicate / skipped / failed summary

#### Scenario: Empty scan
- **WHEN** no eligible candidates are found
- **THEN** the Side Panel SHALL show an empty state with the skip reasons

#### Scenario: VFS disconnected
- **WHEN** the local VFS is not connected
- **THEN** the 抓取本页 action SHALL be disabled
- **AND** the Side Panel SHALL offer the existing reconnect action

#### Scenario: Preview is not the global library
- **WHEN** the scan preview is open
- **THEN** it SHALL show only candidates from the current scan
- **AND** it SHALL NOT show global historical media or global tag filter tabs
- **AND** closing the preview SHALL discard the candidate list

### Requirement: Side Panel shows one-shot save feedback

The Side Panel SHALL surface one-shot save outcomes without mixing them into the capture session.

#### Scenario: Context-menu save with panel open
- **WHEN** a context-menu save completes while the Side Panel is open
- **THEN** the Side Panel SHALL show a toast with the saved or failed result

#### Scenario: Context-menu save with panel closed
- **WHEN** a context-menu save completes while the Side Panel is closed
- **THEN** the extension action badge SHALL indicate success or failure briefly

#### Scenario: No session pollution
- **WHEN** a one-shot save succeeds
- **THEN** the item SHALL NOT appear in the session live feed or session event log
- **AND** the session counters SHALL NOT change
