## ADDED Requirements

### Requirement: Extension Background saves one-shot media candidates

The Extension Background Service Worker SHALL resolve and save user-selected media candidates through the existing `saveFile` ingest path.

#### Scenario: Save an HTTP or HTTPS candidate
- **WHEN** Background receives a one-shot save request for an `http:` or `https:` URL
- **THEN** it SHALL fetch the bytes with the extension host permissions
- **AND** it SHALL require an `image/*` content type
- **AND** it SHALL enforce the per-item size limit
- **AND** it SHALL call `saveFile` with the bytes, MIME type, source URL, and capture time

#### Scenario: Save a data URL
- **WHEN** Background receives a one-shot save request for a `data:` URL
- **THEN** it SHALL decode the payload
- **AND** it SHALL call `saveFile` with the decoded bytes and source metadata

#### Scenario: Save a blob URL
- **WHEN** Background receives a one-shot save request for a `blob:` URL
- **THEN** it SHALL request the bytes from the originating tab's MAIN world
- **AND** it SHALL call `saveFile` with the returned bytes and source metadata
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

### Requirement: Extension Background reports one-shot save results

The Extension Background Service Worker SHALL make one-shot save outcomes visible to the invoking UI.

#### Scenario: Side Panel is open
- **WHEN** a one-shot save completes and the Side Panel is open
- **THEN** Background SHALL send the result to the Side Panel for a toast or result summary

#### Scenario: Side Panel is closed
- **WHEN** a one-shot save completes and the Side Panel is not open
- **THEN** Background SHALL set the extension action badge to a success or failure glyph for a short time
- **AND** it SHALL NOT require the `notifications` permission
