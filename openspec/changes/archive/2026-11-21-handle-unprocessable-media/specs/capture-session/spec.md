## MODIFIED Requirements

### Requirement: Session counters
The system SHALL maintain counters for the active session and update them from session-scoped events.

The counters SHALL include saved count, duplicate count, skipped count, failed count, saved bytes, saved image count, saved video count, AI pending count, AI processing count, AI completed count, AI failed count, AI skipped count, queued video count, and downloading video count.

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
- **AND** a skipped AI outcome SHALL update the AI skipped counter instead of the AI failed counter
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
- **WHEN** an AI task for a hash saved in the active session is queued, started, completed, fails, or is skipped
- **THEN** the Background SHALL emit an AI status event correlated to that session
- **AND** a skipped outcome SHALL be distinguishable from a failed outcome

#### Scenario: Events use the page identity at capture time
- **WHEN** a capture event is emitted after the session tab has navigated
- **THEN** the event SHALL carry the page URL associated with the captured resource rather than only the session's latest URL
