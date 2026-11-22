# One-Shot Media Capture

## Purpose

Define user-initiated one-shot media capture that saves individual images or page-scanned candidates into the global media library without creating, modifying, or appearing in a capture session.
## Requirements
### Requirement: Image context menu saves to the library

The extension SHALL provide a context menu item on images that saves the clicked image to the media library without starting a capture session.

#### Scenario: Save a clicked image
- **WHEN** the user right-clicks an image and chooses "保存图片到媒体库"
- **THEN** the extension SHALL resolve the clicked image URL and save its bytes through the existing streamed upload ingest path
- **AND** it SHALL NOT attach the debugger
- **AND** it SHALL NOT create or modify a capture session

#### Scenario: Supported URL schemes
- **WHEN** the clicked image URL is `http:`, `https:`, `data:`, or `blob:`
- **THEN** the extension SHALL attempt to save it
- **AND** `blob:` URLs SHALL be resolved while the originating page is still alive

#### Scenario: Save result feedback
- **WHEN** a context-menu save completes or fails
- **THEN** the Side Panel SHALL show a toast if it is open
- **AND** otherwise the extension action badge SHALL show a success or failure glyph for a few seconds

#### Scenario: Unsupported page
- **WHEN** the context menu is used on a restricted page such as `chrome://`
- **THEN** the save SHALL fail with a clear unsupported-page message

### Requirement: On-demand page scan

The Side Panel SHALL provide a "抓取本页" action that scans the active tab only when the user invokes it.

#### Scenario: User-initiated scan
- **WHEN** the user clicks "抓取本页"
- **THEN** the extension SHALL inject the scanner into the active tab
- **AND** it SHALL NOT scan any page before that action

#### Scenario: Image sources
- **WHEN** the scanner runs on a page
- **THEN** it SHALL collect candidates from `<img>` elements, `<picture>`/`srcset`, CSS `background-image`, and `<video poster>`
- **AND** it SHALL prefer `currentSrc` for images with `srcset`

#### Scenario: URL normalization
- **WHEN** a candidate URL is relative
- **THEN** the scanner SHALL resolve it to an absolute URL against the page base URL

#### Scenario: Iframe boundary
- **WHEN** the page contains cross-origin iframes
- **THEN** the scan SHALL NOT collect media from inside those iframes
- **AND** the scan result SHALL report that iframes were skipped

#### Scenario: Scan cap
- **WHEN** a page exposes more than 300 candidates
- **THEN** the scanner SHALL keep the 300 largest candidates by known area
- **AND** it SHALL report how many were omitted

### Requirement: Candidate preview and selection

The Side Panel SHALL show scanned candidates before saving and SHALL let the user choose which ones to save.

#### Scenario: Preview list
- **WHEN** a scan returns candidates
- **THEN** the Side Panel SHALL show a preview with a thumbnail when the URL is displayable and a placeholder otherwise, dimensions when known, size hint when known, and source kind for each candidate
- **AND** it SHALL show the total candidate count

#### Scenario: Default selection
- **WHEN** the preview opens
- **THEN** every candidate SHALL be selected by default

#### Scenario: Toggle selection
- **WHEN** the user toggles a candidate, selects all, or clears all
- **THEN** the preview SHALL update the selected count without starting a save

#### Scenario: Save selected
- **WHEN** the user chooses to save the selection
- **THEN** the Side Panel SHALL save exactly the selected candidates
- **AND** it SHALL report saved, duplicate, skipped, and failed counts

#### Scenario: Empty scan
- **WHEN** a scan finds no eligible candidates
- **THEN** the preview SHALL show an empty state with the skip reasons (too small, unsupported scheme, restricted page, or iframe-only content)

### Requirement: Byte resolution by URL scheme

The extension SHALL resolve candidate bytes according to the URL scheme.

#### Scenario: HTTP or HTTPS
- **WHEN** a selected candidate is an `http:` or `https:` URL
- **THEN** the Background SHALL fetch it using the extension's host permissions
- **AND** it SHALL require an `image/*` response type
- **AND** it SHALL enforce a 50 MB per-item limit

#### Scenario: Data URL
- **WHEN** a selected candidate is a `data:` URL
- **THEN** the Background SHALL decode its payload
- **AND** it SHALL enforce the same per-item size cap

#### Scenario: Blob URL
- **WHEN** a selected candidate is a `blob:` URL
- **THEN** the extension SHALL fetch it in the page's MAIN world
- **AND** it SHALL enforce a 20 MB per-item limit
- **AND** it SHALL report a revoked or expired blob as a per-item failure

#### Scenario: Save through the existing pipeline
- **WHEN** bytes are resolved
- **THEN** the extension SHALL upload them through the existing `POST /upload` ingest path with the MIME type, source URL, and capture time
- **AND** AI enqueueing, archive enqueueing, and `file:captured` library updates SHALL happen through the existing app hooks

### Requirement: Noise filters and duplicate reporting

One-shot capture SHALL apply noise filters and SHALL report duplicate content without creating a second library item.

#### Scenario: Dimension filter
- **WHEN** a candidate's known width or height is below 128 pixels
- **THEN** the scanner SHALL skip it
- **AND** it SHALL count it as skipped

#### Scenario: Byte filter
- **WHEN** a resolved image is smaller than 1 KB
- **THEN** the extension SHALL skip it
- **AND** it SHALL report the reason

#### Scenario: SVG noise
- **WHEN** a scanned candidate is an `image/svg+xml` image
- **THEN** the page scan SHALL skip it by default
- **AND** a direct right-click save MAY still save it

#### Scenario: Duplicate hash
- **WHEN** a saved candidate hashes to an existing library item
- **THEN** the extension SHALL report it as a duplicate
- **AND** it SHALL NOT create a second library item

#### Scenario: URL deduplication
- **WHEN** the same resolved URL appears more than once in a scan
- **THEN** the scanner SHALL return one candidate for that URL

### Requirement: One-shot capture is independent of capture sessions

One-shot capture SHALL NOT create, modify, or appear in the global capture session.

#### Scenario: No session required
- **WHEN** no capture session is active and the user saves an image or scans a page
- **THEN** the save SHALL proceed without starting a session

#### Scenario: Session already active
- **WHEN** a capture session is active for another tab and the user scans or saves from the current tab
- **THEN** the one-shot capture SHALL proceed
- **AND** it SHALL NOT stop, pause, or change the active session

#### Scenario: Session counters and feed
- **WHEN** a one-shot save succeeds
- **THEN** the active session counters SHALL NOT change
- **AND** the item SHALL NOT appear in the session live feed or session event log
- **AND** it SHALL appear in the global media library through `file:captured`

#### Scenario: Debugger state
- **WHEN** a one-shot save runs
- **THEN** the extension SHALL NOT attach the debugger to the tab

### Requirement: One-shot capture error handling

One-shot capture SHALL report failures per item and SHALL not abort an entire batch for one failure.

#### Scenario: Fetch failure
- **WHEN** a candidate cannot be fetched (network, CORS, hotlink protection, or HTTP error)
- **THEN** the extension SHALL record a per-item failure with the reason
- **AND** it SHALL continue saving other selected candidates

#### Scenario: Unsupported media
- **WHEN** a resolved response is not an image
- **THEN** the extension SHALL skip that candidate
- **AND** it SHALL report the MIME type or error

#### Scenario: VFS disconnected
- **WHEN** the local VFS is not connected
- **THEN** the Side Panel SHALL disable scanning and saving
- **AND** it SHALL offer the existing reconnect action

#### Scenario: Timeout
- **WHEN** a candidate fetch exceeds the per-item timeout
- **THEN** the extension SHALL abort that item and report a timeout
- **AND** it SHALL continue the remaining selection

### Requirement: One-shot capture permissions

The extension SHALL request only the permissions needed for user-initiated one-shot capture.

#### Scenario: New permissions
- **WHEN** the extension manifest is generated
- **THEN** it SHALL include `contextMenus` and `scripting`
- **AND** it SHALL NOT add new host permissions because `<all_urls>` is already declared

#### Scenario: No background scanning
- **WHEN** the extension is idle
- **THEN** it SHALL NOT inject the scanner or read page DOM until the user invokes a one-shot action
