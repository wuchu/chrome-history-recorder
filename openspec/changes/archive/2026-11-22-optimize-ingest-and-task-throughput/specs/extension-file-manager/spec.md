## MODIFIED Requirements

### Requirement: Extension Background manages file operations

The Extension Background Service Worker SHALL capture media and relay file operations to the app, which owns storage and event emission. Media bytes SHALL be sent through the HTTP `POST /upload` streaming endpoint; the WebSocket `saveFile` RPC remains available for compatibility but SHALL NOT be used by the extension for capture or one-shot saves.

#### Scenario: Capture and save image from network
- **WHEN** the CDP capture controller detects an image response with a valid MIME type
- **THEN** Background captures the bytes and uploads them to the app through `POST /upload` with the MIME type, `X-Source-Url`, and `X-Captured-At`
- **AND** the app stores the file and broadcasts `file:captured`; the extension relays the event to the UI

#### Scenario: Streamed upload for every captured media
- **WHEN** Background has resolved the bytes for a captured image or video
- **THEN** it SHALL send those bytes as an HTTP request body without converting them to a JSON number array
- **AND** it SHALL NOT call the WebSocket `saveFile` method

#### Scenario: List captured files
- **WHEN** the UI requests a file list
- **THEN** Background relays the request to the app's `listFiles` and returns the result

#### Scenario: List files by tag
- **WHEN** the UI requests a file list with a tag filter
- **THEN** Background relays the request to the app's `listFiles` with the tag parameter and returns filtered results

#### Scenario: List trashed files
- **WHEN** the UI requests the trash page contents
- **THEN** Background relays the request to the app's `listFiles` with `status: 'trashed'` and returns the result

#### Scenario: Move file to trash from UI
- **WHEN** the user deletes a file from the Media Library or Side Panel
- **THEN** Background relays the request to the app's `trashFile`
- **AND** the app broadcasts `file:trashed`

#### Scenario: Restore file from trash
- **WHEN** the user restores a file from the Trash page
- **THEN** Background relays the request to the app's `restoreFile`
- **AND** the app broadcasts `file:restored`

#### Scenario: Permanently delete from trash
- **WHEN** the user permanently deletes one file or empties the trash
- **THEN** Background relays `purgeFile`, `emptyTrash`, or `restoreAll` to the app's matching method
- **AND** the app broadcasts `file:purged`, `trash:emptied`, or `trash:restored-all`

### Requirement: Extension Background saves one-shot media candidates

The Extension Background Service Worker SHALL resolve and save user-selected media candidates through the existing streamed upload ingest path.

#### Scenario: Save an HTTP or HTTPS candidate
- **WHEN** Background receives a one-shot save request for an `http:` or `https:` URL
- **THEN** it SHALL fetch the bytes with the extension host permissions
- **AND** it SHALL require an `image/*` content type
- **AND** it SHALL enforce the per-item size limit
- **AND** it SHALL upload the bytes through `POST /upload` with the MIME type, source URL, and capture time

#### Scenario: Save a data URL
- **WHEN** Background receives a one-shot save request for a `data:` URL
- **THEN** it SHALL decode the payload
- **AND** it SHALL upload the decoded bytes through `POST /upload` with the source metadata

#### Scenario: Save a blob URL
- **WHEN** Background receives a one-shot save request for a `blob:` URL
- **THEN** it SHALL request the bytes from the originating tab's MAIN world
- **AND** it SHALL upload the returned bytes through `POST /upload` with the source metadata
- **AND** it SHALL NOT attach the debugger

#### Scenario: Per-item result
- **WHEN** a one-shot save finishes
- **THEN** Background SHALL return a result containing the hash, whether it was a duplicate, and any error reason
- **AND** a failure for one candidate SHALL NOT abort other candidates in the selection

#### Scenario: Automatic downstream work
- **WHEN** a one-shot save creates a new file
- **THEN** the app ingest hook SHALL enqueue AI and archive work as usual
- **AND** Background SHALL relay the resulting `file:captured` event to UI panels

#### Scenario: No capture session side effects
- **WHEN** a one-shot save runs
- **THEN** Background SHALL NOT create, modify, or append to a capture session
- **AND** it SHALL NOT change session counters or the session event log

#### Scenario: Save failure reasons
- **WHEN** a candidate cannot be saved
- **THEN** Background SHALL report a reason such as fetch failure, unsupported MIME type, size limit, expired blob, restricted page, or VFS disconnected
