# Spec: Extension File Manager

## Purpose

Extension 内置的文件管理逻辑，通过调度 VFS 实现本地媒体资源管理

## Requirements


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

### Requirement: Extension Background handles thumbnail requests

The Extension Background Service Worker SHALL provide thumbnail URLs for DevTools Panel display by requesting thumbnails from VFS.

#### Scenario: Get thumbnail URL for file
- **WHEN** DevTools Panel requests thumbnail for hash
- **THEN** Background calls VFS.getThumbnail, receives buffer, creates blob URL (URL.createObjectURL), and returns URL to Panel

#### Scenario: Cache thumbnail blob URLs
- **WHEN** Background receives thumbnail from VFS
- **THEN** Background caches blob URL in memory to avoid repeated VFS calls for same thumbnail

### Requirement: Extension Background provides tag counts

The Extension Background Service Worker SHALL provide tag usage counts for display in the UI.

#### Scenario: Get tag counts
- **WHEN** DevTools Panel requests tag counts via chrome.runtime.sendMessage
- **THEN** Background calls VFS.getTagCounts and returns { all: <total>, images: <count>, videos: <count>, ... } to Panel
