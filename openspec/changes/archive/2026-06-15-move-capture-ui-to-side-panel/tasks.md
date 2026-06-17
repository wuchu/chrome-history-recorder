## 1. Manifest And Entrypoint Setup

- [x] 1.1 Add WXT Side Panel entrypoint files for the media browser UI.
- [x] 1.2 Update `wxt.config.ts` manifest wiring with `side_panel.default_path`, `sidePanel` permission, `debugger` permission, and extension action behavior.
- [x] 1.3 Configure Background startup to open the Side Panel from the extension action where supported.
- [x] 1.4 Keep the existing DevTools entrypoint available as a temporary fallback during migration.

## 2. Shared Media Browser UI

- [x] 2.1 Move reusable DevTools media browser components and hooks into UI modules that can be imported by the Side Panel.
- [x] 2.2 Replace DevTools-specific capture hook usage with a Side Panel capture controller hook backed by Background runtime messages.
- [x] 2.3 Render the Side Panel status bar, live capture stream, classification progress, scrollable tag tabs, virtual masonry grid, and media detail view.
- [x] 2.4 Ensure the masonry grid supports narrow Side Panel widths, including one-column layout.
- [x] 2.5 Add a Side Panel settings action that opens the existing Options page instead of embedding full configuration forms.

## 3. Background Capture Controller

- [x] 3.1 Add a tab-scoped capture state model keyed by `tabId` with enabled state, counts, last capture time, and debugger attachment state.
- [x] 3.2 Add runtime message handlers for current tab capture status, start capture, stop capture, and capture state refresh.
- [x] 3.3 Track active tab changes and Side Panel requests so the UI receives the correct tab capture state.
- [x] 3.4 Clean up capture state and detach debugger sessions when a captured tab closes.
- [x] 3.5 Handle tab refresh/navigation by clearing live per-tab capture state and re-establishing Network listening when capture remains enabled.

## 4. Debugger/CDP Image Capture Backend

- [x] 4.1 Implement a debugger capture service that attaches to a tab and enables the CDP Network domain.
- [x] 4.2 Record candidate image responses from `Network.responseReceived` using response headers, URL, status, and request id.
- [x] 4.3 Apply image filters before body extraction, including MIME type, SVG skip behavior, minimum size, maximum size, and optional domain rules.
- [x] 4.4 On `Network.loadingFinished`, call `Network.getResponseBody` for eligible image requests and decode `base64Encoded` responses correctly.
- [x] 4.5 Send decoded media buffers through the existing `FileManager.handleCaptureMedia` path with source URL, MIME type, and captured timestamp.
- [x] 4.6 Enqueue non-duplicate saved media for classification using the existing scheduler behavior.
- [x] 4.7 Broadcast capture success, skip, and failure events for Side Panel live updates.
- [x] 4.8 Surface debugger attach, detach, and body extraction failures without blocking page navigation.

## 5. Runtime Events And Data Flow

- [x] 5.1 Update Side Panel event handling to consume Background service, capture, VFS, and classification events.
- [x] 5.2 Preserve historical media loading through the existing `listFiles` message protocol.
- [x] 5.3 Merge real-time captures with historical VFS records by hash to avoid duplicate grid items.
- [x] 5.4 Preserve media detail requeue behavior through Background reclassification messages.
- [x] 5.5 Ensure VFS unavailable and Ollama unavailable states remain visible while media browsing stays usable where possible.

## 6. DevTools Migration Cleanup

- [x] 6.1 Isolate or de-emphasize `chrome.devtools.network` capture code so it is not used by the primary Side Panel flow.
- [x] 6.2 Update DevTools media grid code paths to avoid owning primary capture state.
- [x] 6.3 Decide whether to hide, retain, or remove the DevTools panel after debugger capture validation.
- [x] 6.4 Remove obsolete DevTools-only UI assumptions from shared components introduced for the Side Panel.

## 7. Documentation And Specs Follow-through

- [x] 7.1 Update README usage instructions to describe opening and using the Chrome Side Panel.
- [x] 7.2 Update ARCHITECTURE capture diagrams from DevTools Network capture to Side Panel + Background debugger/CDP capture.
- [x] 7.3 Document debugger permission implications and the expected Chrome active-debugging indicator.
- [x] 7.4 Document first-version limitations for canvas `data:` images, page-created `blob:` images, and complex video streams.

## 8. Verification

- [x] 8.1 Run TypeScript compile for the extension package.
- [x] 8.2 Run workspace lint and fix any issues introduced by the migration.
- [x] 8.3 Build the extension and verify WXT generates the Side Panel manifest fields and debugger permission.
- [ ] 8.4 Manually verify Side Panel opens from the extension action in Chrome.
- [ ] 8.5 Manually verify image capture on ordinary `<img>` resources, lazy-loaded images, cached images, CDN images, and large-image skip behavior.
- [ ] 8.6 Manually verify capture start/stop, tab refresh, tab switch, and tab close cleanup.
- [ ] 8.7 Manually verify captured files appear in VFS history, thumbnails render, duplicates are not shown twice, and classification queue events update the Side Panel.
- [ ] 8.8 Manually verify debugger attach failures are visible in the Side Panel and do not leave capture marked active.
