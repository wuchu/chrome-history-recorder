## MODIFIED Requirements

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
