## Why

The extension's background service worker freezes the whole browser at startup — the Options page, the side panel, and even unrelated web pages become unclickable for tens of seconds to minutes, then recover on their own. The trigger is the AI task engine auto-resuming a backlog of `classify`/`rename` tasks, and the freeze is caused by a synchronous, byte-by-byte base64 encoding in the Ollama vision request path that monopolizes the service worker's single thread.

## What Changes

- Replace the synchronous per-byte `reduce` + `btoa` base64 encoding in `OllamaClient.callVision` with a chunked, asynchronous encoder that yields to the event loop between chunks.
- Reorder `OllamaClient.getRepresentativeImage` to request the cached thumbnail before the full original, so large originals are not shipped over the JSON WebSocket on the common path.
- Ensure request-body construction for large image payloads does not block background message handling (`chrome.runtime.sendMessage` responses, queue status, VFS events).
- Keep the existing resume-on-startup behavior, but make per-task work non-blocking so a running engine no longer freezes the UI.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ollama-classifier`: Add requirements that vision request encoding SHALL NOT synchronously block the service worker thread (bounded chunks that yield), and that the classifier SHALL prefer a downscaled thumbnail over the full original when preparing a representative image.

## Impact

- Code: `packages/extension/src/background/classify/ollama-client.ts` (`callVision`, and the base64/normalization helpers it uses).
- No public API, message protocol, or VFS service changes.
- No new dependencies.
