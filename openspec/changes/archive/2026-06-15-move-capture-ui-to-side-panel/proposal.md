## Why

The current capture UI and image interception are coupled to Chrome DevTools: the media browser runs in a DevTools panel and the capture path depends on `chrome.devtools.network.onRequestFinished` plus `request.getContent()`. Moving the product UI into Chrome's right-side Side Panel makes the recorder easier to keep open during normal browsing, but Side Panel pages cannot use DevTools Network APIs, so capture responsibility must move into the Extension Background.

## What Changes

- Introduce a Chrome Side Panel media browser as the primary extension UI for capture control, live capture stream, historical media browsing, classification progress, tag filtering, and media details.
- Move image capture orchestration from the DevTools panel into the Background Service Worker, keyed by active tab id and controlled by Side Panel messages.
- Replace the DevTools Network capture backend with a Chrome debugger/CDP Network backend for image capture, using `chrome.debugger`, `Network.responseReceived`, `Network.loadingFinished`, and `Network.getResponseBody` where available.
- Reuse the existing VFS save path, duplicate detection, thumbnail generation, and classification queue after a media response body is captured.
- Preserve the dedicated Options page as the source of truth for runtime settings; the Side Panel focuses on capture, browsing, live status, and quick actions.
- **BREAKING**: The DevTools panel is no longer the primary media capture and browsing surface. Existing DevTools-only requirements are superseded by Side Panel requirements.

## Capabilities

### New Capabilities

- `side-panel-media-browser`: Chrome Side Panel UI for media capture control, live capture stream, historical browsing, tag filtering, service status, classification progress, and media detail actions.

### Modified Capabilities

- `image-capture-extension`: Change image detection and response-body capture from DevTools Network APIs to Background-controlled Chrome debugger/CDP capture for the active tab.
- `devtools-media-grid`: Supersede DevTools panel media browsing requirements with the Side Panel media browser as the primary UI surface.
- `virtual-masonry-grid`: Allow the existing virtual masonry browser to be hosted by the Side Panel and receive Background runtime events instead of DevTools/WebSocket-specific assumptions.
- `extension-classify-controls`: Move classification controls and media requeue actions from DevTools wording to the Side Panel and Options surfaces.

## Impact

- Extension manifest and WXT configuration: add Side Panel wiring and debugger permission; remove or de-emphasize `devtools_page` after migration is complete.
- Extension entrypoints: add a Side Panel React entrypoint; migrate reusable DevTools panel components/hooks into shared UI modules where practical.
- Background Service Worker: add tab-scoped capture state, debugger attach/detach lifecycle, CDP Network event handling, response-body extraction, capture filtering, and event broadcasting.
- Existing capture code: retire or keep as fallback the DevTools-only `NetworkListener` and `useNetworkListener` path.
- User experience: Chrome may show debugger permission and active debugging indicators while capture is enabled.
- Documentation/specs: update DevTools-focused requirements, architecture notes, and setup instructions to describe the Side Panel + Background capture model.
