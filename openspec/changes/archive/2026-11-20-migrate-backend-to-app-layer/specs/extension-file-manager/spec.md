## MODIFIED Requirements

### Requirement: Extension Background manages file operations

The Extension Background Service Worker SHALL capture media and relay file operations to the app, which owns storage and event emission.

#### Scenario: Capture and save image from network
- **WHEN** the CDP capture controller detects an image response with a valid MIME type
- **THEN** Background captures the bytes and sends them to the app via `saveFile` (or `POST /upload`)
- **AND** the app stores the file and broadcasts `file:captured`; the extension relays the event to the UI

#### Scenario: List captured files
- **WHEN** the UI requests a file list
- **THEN** Background relays the request to the app's `listFiles` and returns the result

#### Scenario: List files by tag
- **WHEN** the UI requests a file list with a tag filter
- **THEN** Background relays the request to the app's `listFiles` with the tag parameter and returns filtered results

#### Scenario: Delete file from UI
- **WHEN** the user deletes a file
- **THEN** Background relays the request to the app's `deleteFile`, and the app broadcasts `file:deleted`

### Requirement: Extension Background provides file event broadcasting

The Extension Background Service Worker SHALL relay app-originated file events to connected UI panels using `chrome.runtime.sendMessage`.

#### Scenario: Broadcast file captured event
- **WHEN** the app broadcasts a `file:captured` event over the WebSocket
- **THEN** Background relays `{ type: 'file:captured', data: { hash, mimeType, size, ... } }` to connected panels

#### Scenario: Broadcast file classified event
- **WHEN** the app broadcasts a `file:classified` event
- **THEN** Background relays `{ type: 'file:classified', data: { hash, tags, aiFilename, ... } }` to connected panels

#### Scenario: Broadcast file deleted event
- **WHEN** the app broadcasts a `file:deleted` event
- **THEN** Background relays `{ type: 'file:deleted', data: { hash } }` to connected panels
