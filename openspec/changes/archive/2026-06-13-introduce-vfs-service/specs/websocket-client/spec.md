## REMOVED Requirements

### Requirement: Extension connects to WebSocket server

**Reason**: WebSocket communication is replaced by Native Messaging for VFS operations and chrome.runtime.sendMessage for internal events.

**Migration**:
- WebSocket `ws://localhost:3777/events` → chrome.runtime.connectNative('com.yourapp.vfs')
- WebSocket reconnect logic → Native Messaging disconnect/reconnect handling

### Requirement: Extension subscribes to WebSocket events

**Reason**: Event subscription is no longer needed. All events are broadcast via chrome.runtime.sendMessage.

**Migration**:
- `subscribe(['file:captured'])` → Automatic broadcast from Background to all Panels
- `unsubscribe(['file:captured'])` → No longer needed (all Panels receive all events)