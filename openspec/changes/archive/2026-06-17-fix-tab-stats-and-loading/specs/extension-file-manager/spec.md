# Spec: Extension File Manager (Delta)

## MODIFIED Requirements

### Requirement: Extension Background manages file operations

The Extension Background Service Worker SHALL coordinate all file operations through the VFS Service Native Messaging client.

#### Scenario: Capture and save image from network
- **WHEN** Content Script detects image response with valid MIME type
- **THEN** Background receives ArrayBuffer from Content Script via chrome.runtime.sendMessage, calculates hash, calls VFS.saveFile, and broadcasts 'file:captured' event to DevTools Panel

#### Scenario: List captured files
- **WHEN** DevTools Panel requests file list via chrome.runtime.sendMessage
- **THEN** Background calls VFS.listFiles with pagination parameters and returns result to Panel

#### Scenario: List files by tag
- **WHEN** DevTools Panel requests file list with { tag: 'images' } or { tag: 'uncategorized' } or { tag: '<user-tag>' }
- **THEN** Background calls VFS.listFiles with the tag parameter and returns filtered results to Panel

#### Scenario: Delete file from UI
- **WHEN** User clicks delete button in DevTools Panel
- **THEN** Panel sends message to Background, Background calls VFS.deleteFile, and Background broadcasts 'file:deleted' event

### Requirement: Extension Background provides tag counts

The Extension Background Service Worker SHALL provide tag usage counts for display in the UI.

#### Scenario: Get tag counts
- **WHEN** DevTools Panel requests tag counts via chrome.runtime.sendMessage
- **THEN** Background calls VFS.getTagCounts and returns { all: <total>, images: <count>, videos: <count>, ... } to Panel
