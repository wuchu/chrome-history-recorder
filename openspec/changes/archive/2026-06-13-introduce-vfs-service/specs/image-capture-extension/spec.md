## MODIFIED Requirements

### Requirement: Extension captures images from network requests

The Extension SHALL capture image responses from network requests and save them to VFS Service.

#### Scenario: Capture image response
- **WHEN** Content Script detects image response with MIME type image/jpeg, image/png, image/gif, image/webp, image/bmp
- **THEN** Content Script extracts response body as ArrayBuffer, sends to Background via chrome.runtime.sendMessage with { type: 'capture:media', data: { buffer, mimeType, url } }

#### Scenario: Save captured image to VFS
- **WHEN** Background receives capture:media message from Content Script
- **THEN** Background calls VFS.saveFile with buffer, mimeType, sourceUrl, capturedAt, and broadcasts file:captured event

#### Scenario: Skip duplicate capture
- **WHEN** VFS.saveFile returns { duplicate: true }
- **THEN** Background broadcasts file:captured event with duplicate: true flag, DevTools Panel shows indicator

### Requirement: Extension enqueues captured images for classification

The Extension SHALL automatically enqueue captured images for AI classification after successful save.

#### Scenario: Enqueue image after save
- **WHEN** Image is saved successfully (not duplicate)
- **THEN** Background calls VFS.enqueueClassification with hash

#### Scenario: Skip classification for duplicate
- **WHEN** Image is duplicate (already exists in VFS)
- **THEN** Background does not enqueue for classification

#### Scenario: Skip classification if Ollama unavailable
- **WHEN** Ollama health check indicates unavailable
- **THEN** Background saves file but does not enqueue for classification