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

### Requirement: Extension Background provides file event broadcasting

The Extension Background Service Worker SHALL relay app-originated file events to connected UI panels using `chrome.runtime.sendMessage`.

#### Scenario: Broadcast file captured event
- **WHEN** the app broadcasts a `file:captured` event over the WebSocket
- **THEN** Background relays `{ type: 'file:captured', data: { hash, mimeType, size, ... } }` to connected panels

#### Scenario: Broadcast file classified event
- **WHEN** the app broadcasts a `file:classified` event
- **THEN** Background relays `{ type: 'file:classified', data: { hash, tags, aiFilename, ... } }` to connected panels

#### Scenario: Broadcast file trashed event
- **WHEN** the app broadcasts a `file:trashed` event
- **THEN** Background relays `{ type: 'file:trashed', data: { hash, deletedAt } }` to connected panels

#### Scenario: Broadcast file restored event
- **WHEN** the app broadcasts a `file:restored` event
- **THEN** Background relays `{ type: 'file:restored', data: { hash, restoredAt } }` to connected panels

#### Scenario: Broadcast file purged event
- **WHEN** the app broadcasts a `file:purged` event
- **THEN** Background relays `{ type: 'file:purged', data: { hash } }` to connected panels

#### Scenario: Broadcast trash cleared events
- **WHEN** the app broadcasts `trash:emptied` or `trash:restored-all`
- **THEN** Background relays `{ type: 'trash:emptied', data: { count } }` or `{ type: 'trash:restored-all', data: { count } }` to connected panels
- **AND** it SHALL NOT relay the removed `file:deleted` event
