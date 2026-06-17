## REMOVED Requirements

### Requirement: Proxy supports plugin system with hooks

**Reason**: Plugin architecture is no longer needed. All business logic (AI classification) is now implemented directly in Extension Background.

**Migration**:
- Plugin `afterSave` hook → Extension Background automatically enqueues classification after VFS.saveFile
- Plugin `beforeDelete` hook → Extension Background checks before calling VFS.deleteFile
- Plugin routes `/plugins/:name/:route` → Direct Extension Background handlers

### Requirement: Proxy discovers and loads plugins from plugins/ directory

**Reason**: No plugin directory needed. VFS Service is a pure storage engine without business logic hooks.

**Migration**:
- `proxy/plugins/ai-classify/plugin.ts` → `extension/src/background/classify/` module
- Plugin config in `proxy-config.yaml` → Extension config in chrome.storage.local