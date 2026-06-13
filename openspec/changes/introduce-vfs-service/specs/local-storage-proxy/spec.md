## REMOVED Requirements

### Requirement: Proxy provides HTTP API for file storage

**Reason**: Proxy Server is replaced by VFS Service. File storage API is now provided via Native Messaging from Extension.

**Migration**: 
- HTTP `/save-image` → VFS.saveFile() via Native Messaging
- HTTP `/images` → VFS.listFiles() via Native Messaging  
- HTTP `/images/:hash` → VFS.getFile() via Native Messaging
- HTTP `/images/:hash/thumbnail` → VFS.getThumbnail() via Native Messaging

### Requirement: Proxy provides WebSocket event broadcasting

**Reason**: WebSocket communication is replaced by chrome.runtime.sendMessage within Extension.

**Migration**:
- WebSocket event 'file:captured' → chrome.runtime.sendMessage from Background to Panel
- WebSocket event 'classify:started/complete/failed' → chrome.runtime.sendMessage
- WebSocket heartbeat → No longer needed (Extension manages connection)

### Requirement: Proxy manages storage path configuration

**Reason**: Workspace configuration is now managed by VFS Service with default ~/.vfs-workspace.

**Migration**:
- HTTP `/config/storage-path` → VFS.getWorkspaceConfig() / setWorkspaceConfig()