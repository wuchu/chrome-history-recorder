## REMOVED Requirements

### Requirement: WebSocket server broadcasts file events

**Reason**: WebSocket server is removed. Events are now broadcast within Extension using chrome.runtime.sendMessage.

**Migration**:
- `wsServer.emitFileCaptured()` → Background sends chrome.runtime.sendMessage({ type: 'file:captured', data })
- `wsServer.emitClassifyComplete()` → Background sends chrome.runtime.sendMessage({ type: 'file:classified', data })

### Requirement: WebSocket server supports heartbeat

**Reason**: Native Messaging connection is managed by Chrome. No heartbeat needed.

**Migration**:
- Heartbeat interval → Not applicable (Chrome manages connection lifetime)

### Requirement: WebSocket server supports client subscription filtering

**Reason**: All DevTools Panels receive all events. Filtering is no longer needed.

**Migration**:
- `subscribe/unsubscribe` actions → Not applicable (Background broadcasts to all Panels)