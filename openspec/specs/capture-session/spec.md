# Capture Session

## Purpose

Maintain a single tab-scoped capture session with counters, a bounded event log, a restorable snapshot, and a stopped-session summary.

## Requirements

### Requirement: Single active capture session
The system SHALL permit at most one active capture session across all browser tabs at any time.

#### Scenario: Start the first session
- **WHEN** no capture session is active and the user starts capture for a tab
- **THEN** the system SHALL create one active session owned by that tab
- **AND** that tab SHALL be the only tab reporting an active capture session

#### Scenario: Start a session while another is active
- **WHEN** a session is active for tab A and capture is started for tab B
- **THEN** the system SHALL end the session for tab A before the session for tab B becomes active
- **AND** at no point SHALL two tabs report an active capture session

#### Scenario: Same-tab start is idempotent
- **WHEN** capture is started for the tab that already owns the active session
- **THEN** the system SHALL return the existing session state
- **AND** the system SHALL NOT reset the session counters or event history

### Requirement: Session identity and tab scope
The system SHALL identify a capture session by its owning tab and SHALL record the tab id, tab title, current page URL, origin, start time, and status.

#### Scenario: Create session identity
- **WHEN** a capture session starts for a tab
- **THEN** the session SHALL record the tab id, tab title, page URL, origin, and start time
- **AND** the session status SHALL be `capturing`

#### Scenario: Same-tab navigation keeps the session
- **WHEN** the session tab navigates to a new page without closing the tab
- **THEN** the session SHALL remain active
- **AND** the session's current page URL and origin SHALL update to the new page
- **AND** the session counters and event log SHALL be preserved

#### Scenario: Cross-origin navigation keeps the session
- **WHEN** the session tab navigates to a different origin
- **THEN** the session SHALL remain active
- **AND** the session SHALL update its page identity to the new origin instead of ending

#### Scenario: Tab title changes update identity
- **WHEN** the session tab's title changes
- **THEN** the session SHALL update its recorded tab title

### Requirement: Session lifecycle
A capture session SHALL begin only on an explicit capture start and SHALL end on an explicit stop, tab close, debugger detach, or browser shutdown.

#### Scenario: Stop ends the session
- **WHEN** the user stops capture for the session tab
- **THEN** the session SHALL end with status `stopped`
- **AND** the system SHALL retain a session summary for display

#### Scenario: Closing the session tab ends the session
- **WHEN** the session tab is closed
- **THEN** the session SHALL end
- **AND** the system SHALL NOT continue capturing in another tab

#### Scenario: Debugger detach ends the session
- **WHEN** the capture debugger detaches from the session tab for any reason other than a panel close
- **THEN** the session SHALL end with an error status when the detach is not a normal target close
- **AND** the session SHALL end with status `stopped` when the target closes normally

#### Scenario: Closing the Side Panel does not end the session
- **WHEN** the Side Panel is closed while a session is active
- **THEN** the session SHALL continue capturing in its tab
- **AND** reopening the Side Panel SHALL restore the session view from a snapshot

#### Scenario: Service worker restart restores the session
- **WHEN** the Background Service Worker restarts while a session is active and the capture attachment remains valid
- **THEN** the system SHALL restore the session identity, counters, and event log from the session snapshot

#### Scenario: Browser restart clears the session
- **WHEN** the browser is restarted
- **THEN** the previous session SHALL no longer be active or restorable

### Requirement: Session counters
The system SHALL maintain counters for the active session and update them from session-scoped events.

The counters SHALL include saved count, duplicate count, skipped count, failed count, saved bytes, saved image count, saved video count, AI pending count, AI processing count, AI completed count, AI failed count, queued video count, and downloading video count.

#### Scenario: Increment on save
- **WHEN** a media resource is saved as a new file in the session
- **THEN** the saved count SHALL increase by one
- **AND** the saved bytes SHALL increase by the file size
- **AND** the image or video count SHALL increase according to the MIME type

#### Scenario: Count duplicates separately
- **WHEN** a captured resource matches an existing content hash
- **THEN** the duplicate count SHALL increase by one
- **AND** the saved count SHALL NOT increase

#### Scenario: Count skips and failures
- **WHEN** a capture is skipped by a capture rule
- **THEN** the skipped count SHALL increase by one
- **WHEN** a capture fails
- **THEN** the failed count SHALL increase by one

#### Scenario: Counters survive navigation
- **WHEN** the session tab navigates to another page
- **THEN** the session counters SHALL retain their values

#### Scenario: AI status is correlated by hash
- **WHEN** an AI task event references a hash saved in the active session
- **THEN** the corresponding AI counter SHALL update for that session
- **AND** AI events for hashes outside the session SHALL NOT affect the session counters

### Requirement: Session-scoped capture events
The Background Service Worker SHALL emit session-scoped capture events carrying the session tab id, current page URL, event type, timestamp, and available hash and source URL.

The event types SHALL include saved, duplicate, skipped, failed, video candidate, video result, and AI status.

#### Scenario: Emit saved event
- **WHEN** an image or video is saved during the session
- **THEN** the Background SHALL emit a saved event containing the tab id, page URL, hash, MIME type, size, source URL, and capture time

#### Scenario: Emit duplicate event
- **WHEN** a captured resource matches an existing hash
- **THEN** the Background SHALL emit a duplicate event containing the tab id, page URL, existing hash, source URL, and capture time

#### Scenario: Emit skip event with reason
- **WHEN** a resource is skipped by a capture rule
- **THEN** the Background SHALL emit a skipped event containing the tab id, page URL, source URL, and human-readable reason

#### Scenario: Emit failure event
- **WHEN** reading or saving a resource fails
- **THEN** the Background SHALL emit a failed event containing the tab id, page URL, source URL, and error message

#### Scenario: Emit video pipeline events
- **WHEN** a video candidate is detected, queued, completed, or fails
- **THEN** the Background SHALL emit the corresponding video event containing the tab id, page URL, source URL, and available hash or error

#### Scenario: Emit AI status for session hashes
- **WHEN** an AI task for a hash saved in the active session is queued, started, completed, or fails
- **THEN** the Background SHALL emit an AI status event correlated to that session

#### Scenario: Events use the page identity at capture time
- **WHEN** a capture event is emitted after the session tab has navigated
- **THEN** the event SHALL carry the page URL associated with the captured resource rather than only the session's latest URL

### Requirement: Bounded session event log
The system SHALL retain a bounded in-memory event log for the active session.

#### Scenario: Bound the log
- **WHEN** more than 200 events have been recorded in the session
- **THEN** the system SHALL retain the newest 200 events
- **AND** the system SHALL discard the oldest events first

#### Scenario: Log entry content
- **WHEN** an event is added to the session log
- **THEN** the entry SHALL include the event type, timestamp, page URL, and any available hash, source URL, size, and reason

#### Scenario: Clear the log without ending the session
- **WHEN** the user clears the session event log
- **THEN** the event log SHALL become empty
- **AND** the session SHALL remain active
- **AND** the session counters SHALL remain unchanged

### Requirement: Session snapshot and restore
The system SHALL persist a session snapshot in `chrome.storage.session` and SHALL clear it on browser restart.

#### Scenario: Snapshot content
- **WHEN** a session snapshot is written
- **THEN** it SHALL include the session identity, status, counters, recent saved items, event log, and latest summary when the session is stopped

#### Scenario: Reopen the Side Panel
- **WHEN** the Side Panel requests the session snapshot after the panel was closed
- **THEN** the Background SHALL return the current or most recently stopped session snapshot

#### Scenario: Throttled snapshot writes
- **WHEN** events arrive in rapid succession
- **THEN** the system SHALL throttle snapshot writes so that capture processing is not blocked by storage writes

#### Scenario: Browser restart clears the snapshot
- **WHEN** the browser restarts
- **THEN** the previous session snapshot SHALL NOT be restored

### Requirement: Session summary
The system SHALL retain a summary of the most recently stopped session until a new session starts.

#### Scenario: Summary content
- **WHEN** a session stops
- **THEN** the summary SHALL include the session duration, saved, duplicate, skipped, and failed counts, saved bytes, image and video counts, and the most frequent skip or failure reasons

#### Scenario: New session replaces the summary
- **WHEN** a new session starts
- **THEN** the previous session summary SHALL be replaced

#### Scenario: Summary survives panel reopen
- **WHEN** the user reopens the Side Panel after stopping a session
- **THEN** the Side Panel SHALL be able to display the retained session summary

### Requirement: Ephemeral session data
Capture session data SHALL remain ephemeral and SHALL NOT be written to the VFS file index.

#### Scenario: Session data is not persisted in VFS
- **WHEN** a capture session runs
- **THEN** the system SHALL NOT create VFS file records for the session itself
- **AND** the system SHALL NOT expose session history through `listFiles`

#### Scenario: Session data does not become site history
- **WHEN** a session ends or is restored
- **THEN** the system SHALL NOT provide a query for resources captured by a site or page in previous sessions
