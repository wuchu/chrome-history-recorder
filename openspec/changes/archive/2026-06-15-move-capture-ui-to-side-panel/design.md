## Context

The extension currently presents its media recorder UI inside a Chrome DevTools panel. That panel owns the live network listener through `chrome.devtools.network.onRequestFinished`, calls `request.getContent()` for response bodies, and sends captured media bytes to the Background Service Worker through `capture:media`. The Background already owns VFS persistence, duplicate detection, classification enqueueing, service status, and runtime messaging.

The desired product shape is different: users should keep the recorder open in Chrome's right-side Side Panel during normal browsing. Side Panel pages cannot access `chrome.devtools.*`, so capture must move out of the UI and into Background. The practical Chrome API that can still obtain response bodies from Background is `chrome.debugger` with Chrome DevTools Protocol Network events.

## Goals / Non-Goals

**Goals:**

- Make the Side Panel the primary capture and media browsing UI.
- Move tab-scoped capture state and network interception into the Background Service Worker.
- Use Chrome debugger/CDP Network as the primary image capture backend for active tabs.
- Reuse the existing VFS save, thumbnail, duplicate detection, event broadcast, and classification queue path.
- Preserve the Options page as the configuration surface and keep the Side Panel focused on capture and browsing.
- Keep the implementation staged so the existing DevTools path can remain as a temporary fallback during validation.

**Non-Goals:**

- Full video reconstruction from streaming, Range, MSE, or blob playback flows.
- Capturing canvas-generated `data:` URLs or page-created `blob:` URLs in the first Side Panel migration.
- Replacing the VFS service, classifier, thumbnail API, or Options page configuration model.
- Supporting non-Chrome browsers.

## Decisions

### Decision 1: Side Panel becomes the primary UI surface

Use a new WXT Side Panel entrypoint for capture controls, live capture stream, tag-filtered media browsing, classification progress, and media details.

Alternatives considered:
- Keep DevTools as primary UI: rejected because the desired workflow is normal browsing with a persistent right-side panel.
- Use popup: rejected because popup closes easily and is poor for browsing large media grids.
- Use Options as the main UI: rejected because Options is better suited to configuration than live capture.

### Decision 2: Background owns capture state

Introduce a Background capture controller keyed by `tabId`. The Side Panel sends start/stop/status messages; Background attaches/detaches capture backends and broadcasts capture events.

Alternatives considered:
- Keep capture logic in UI: rejected because Side Panel cannot use DevTools Network APIs and UI lifecycle should not own interception.
- Add content-script fetch monkey-patching: rejected because it misses native image loads, cache behavior, and many browser-level requests.

### Decision 3: Use `chrome.debugger` with CDP Network for image bodies

The capture backend attaches to a tab with `chrome.debugger.attach`, enables Network, records candidate image responses from `Network.responseReceived`, and calls `Network.getResponseBody` after `Network.loadingFinished`.

Alternatives considered:
- `webRequest`: useful for headers and metadata, but MV3 does not provide response bodies.
- `declarativeNetRequest`: useful for request modification, but cannot capture body bytes.
- CDP Fetch domain: powerful for pausing/modifying requests, but unnecessary for first-pass passive capture and higher risk of affecting page loading.

### Decision 4: Keep media persistence unchanged

After decoding the captured body, Background calls the existing `FileManager.handleCaptureMedia` path and enqueues classification for non-duplicates. This limits the migration to the capture/UI boundary.

### Decision 5: Stage migration with a temporary fallback

The first implementation should add Side Panel and debugger capture without immediately deleting DevTools files. Once debugger behavior is verified on representative pages, DevTools-specific capture entrypoints can be retired.

## Risks / Trade-offs

- `debugger` permission is sensitive and visible to users -> Explain capture mode in product copy outside the app store listing and keep capture manually controlled per tab.
- Chrome may show an active debugging indicator while capture is enabled -> Treat this as an expected transparency signal and ensure stop capture detaches promptly.
- `chrome.debugger` can conflict with other debugger clients for the same tab -> Surface attach failures in the Side Panel and leave the tab uncaptured.
- MV3 service worker lifecycle may interrupt long-running capture -> Use Side Panel runtime ports while the panel is open and persist enough tab state to detach cleanly on restart.
- `Network.getResponseBody` can fail for cached, discarded, huge, or unavailable bodies -> Record failures per request, keep browsing functional, and fall back to metadata-only skip events.
- Large images can increase memory pressure because bodies are decoded in Background -> enforce max-size filters before body extraction when `Content-Length` is available and limit concurrent body reads.
- Video capture remains incomplete -> keep video support best-effort or explicitly preserve the existing limitations until a separate video design is created.

## Migration Plan

1. Add Side Panel manifest wiring and a new React entrypoint that reuses existing media browsing components and runtime-message hooks.
2. Create shared UI modules from reusable DevTools panel components/hooks; isolate the DevTools-only network listener.
3. Add Background capture controller messages for current tab status, start capture, stop capture, and capture events.
4. Implement debugger/CDP image capture for active tabs with filtering, queueing, body extraction, VFS save, and classification enqueueing.
5. Validate on ordinary images, lazy-loaded images, cached images, CDN images, large images, tab refresh, tab switch, and tab close.
6. Update README/ARCHITECTURE and specs to present Side Panel as the supported capture UI.
7. After validation, remove or hide the DevTools media panel and DevTools Network capture path.

Rollback strategy: keep the existing DevTools capture code untouched until the Side Panel capture backend is proven. If debugger capture is not acceptable, disable the Side Panel capture toggle and retain Side Panel as a VFS browser while DevTools capture remains available.

## Open Questions

- Should capture continue after the Side Panel closes, or should closing the Side Panel stop capture for privacy and lifecycle simplicity?
- Should the DevTools panel be fully removed in the same implementation, or left behind as a hidden fallback for one release?
- Should debugger capture initially support videos at all, or should videos remain explicitly out of scope for the first migration?
