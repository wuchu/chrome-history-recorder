## MODIFIED Requirements

### Requirement: Extension captures videos from network requests

The Extension SHALL capture video responses from network requests and save them to VFS Service.

#### Scenario: Capture video response
- **WHEN** Content Script detects video response with MIME type video/mp4, video/webm, video/quicktime
- **THEN** Content Script extracts response body as ArrayBuffer, sends to Background via chrome.runtime.sendMessage with { type: 'capture:media', data: { buffer, mimeType, url } }

#### Scenario: Save captured video to VFS
- **WHEN** Background receives capture:media message for video
- **THEN** Background calls VFS.saveFile with buffer, mimeType, sourceUrl, capturedAt, and broadcasts file:captured event

#### Scenario: Enqueue video for classification
- **WHEN** Video is saved successfully
- **THEN** Background calls VFS.enqueueClassification with hash (video classification uses first frame)

#### Scenario: Skip large videos
- **WHEN** Video size exceeds maxFileSize limit (configurable, default 50MB)
- **THEN** Content Script does not capture, logs warning about size limit