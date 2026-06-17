## ADDED Requirements

### Requirement: Extension Background manages file operations

The Extension Background Service Worker SHALL coordinate all file operations through the VFS Service Native Messaging client.

#### Scenario: Capture and save image from network
- **WHEN** Content Script detects image response with valid MIME type
- **THEN** Background receives ArrayBuffer from Content Script via chrome.runtime.sendMessage, calculates hash, calls VFS.saveFile, and broadcasts 'file:captured' event to DevTools Panel

#### Scenario: List captured files
- **WHEN** DevTools Panel requests file list via chrome.runtime.sendMessage
- **THEN** Background calls VFS.listFiles with pagination parameters and returns result to Panel

#### Scenario: Delete file from UI
- **WHEN** User clicks delete button in DevTools Panel
- **THEN** Panel sends message to Background, Background calls VFS.deleteFile, and Background broadcasts 'file:deleted' event

### Requirement: Extension Background provides file event broadcasting

The Extension Background Service Worker SHALL broadcast file events to connected DevTools Panels using chrome.runtime.sendMessage.

#### Scenario: Broadcast file captured event
- **WHEN** File is successfully saved to VFS
- **THEN** Background sends { type: 'file:captured', data: { hash, mimeType, size, ... } } to all connected Panels

#### Scenario: Broadcast file classified event
- **WHEN** AI classification completes
- **THEN** Background sends { type: 'file:classified', data: { hash, category, aiFilename, ... } } to all connected Panels

#### Scenario: Broadcast file deleted event
- **WHEN** File is deleted from VFS
- **THEN** Background sends { type: 'file:deleted', data: { hash } } to all connected Panels

### Requirement: Extension Background handles thumbnail requests

The Extension Background Service Worker SHALL provide thumbnail URLs for DevTools Panel display by requesting thumbnails from VFS.

#### Scenario: Get thumbnail URL for file
- **WHEN** DevTools Panel requests thumbnail for hash
- **THEN** Background calls VFS.getThumbnail, receives buffer, creates blob URL (URL.createObjectURL), and returns URL to Panel

#### Scenario: Cache thumbnail blob URLs
- **WHEN** Background receives thumbnail from VFS
- **THEN** Background caches blob URL in memory to avoid repeated VFS calls for same thumbnail