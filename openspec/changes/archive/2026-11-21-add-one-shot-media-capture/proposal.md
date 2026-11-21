## Why

Saving a single image currently requires opening the Side Panel, starting a capture session, accepting Chrome's debugger banner, scrolling the page, and stopping the session. The network-only CDP capture also silently skips `data:` and `blob:` images, which are common in modern web apps. This makes the product feel like a recorder when the user often just wants to keep something they are looking at.

This change adds user-initiated, session-independent capture: right-click an image, or scan the current page and save selected media. It reuses the existing `saveFile` ingest pipeline, so deduplication, AI tasks, archive tasks, and library events work without a parallel storage path.

## What Changes

- Add an image context menu item, **保存图片到媒体库**, that saves the clicked image without attaching the debugger or creating a capture session.
- Add a **抓取本页** action in the Side Panel that scans the active tab on demand and shows a preview of candidate media before saving.
- Scan and support:
  - `<img>` / `<picture>` using `currentSrc` and `srcset` (largest candidate);
  - CSS `background-image` URLs from computed styles;
  - `<video>` poster images;
  - `http(s)`, `data:`, and `blob:` image URLs.
- Fetch strategy:
  - `http(s)`: Background fetch with existing host permissions;
  - `data:`: decode the data URL;
  - `blob:`: fetch in the page's MAIN world while the page is alive.
- Noise and duplicate control:
  - default minimum 128×128 dimensions and 1 KB bytes for scanned candidates;
  - cap a scan at 300 candidates;
  - report saved / duplicate / skipped / failed counts per scan;
  - use the existing `saveFile` hash dedupe and `file:captured` events.
- Reuse the existing ingest pipeline; one-shot saves **SHALL NOT** create, modify, or appear in a capture session, its counters, or its live feed.
- Add `contextMenus` and `scripting` permissions. No new host permissions are required because `<all_urls>` is already declared.
- Clarify the existing capture specs:
  - the CDP network path still does not restore `data:`/`blob:` responses, but one-shot capture does best-effort support them;
  - the current product uses one global capture session, not per-tab sessions;
  - `file:captured` carries `sourceUrl`, `sourceDomain`, and `capturedAt`.

Out of scope for this change:

- Site rules, allowlists, and automatic capture.
- HLS/DASH or MSE video reconstruction.
- Canvas/WebGL `toBlob` capture.
- Multiple concurrent capture sessions.
- Installer, autostart, or backend pairing/authentication.

## Capabilities

### New Capabilities

- `one-shot-media-capture`: right-click image save, on-demand page scanning, candidate selection/preview, data/blob support, noise filters, dedupe, batch save progress, and the guarantee that one-shot saves are independent of capture sessions.

### Modified Capabilities

- `image-capture-extension`: clarify that CDP network capture remains network-only, add the one-shot fallback for `data:`/`blob:`, and resolve the per-tab vs global single-session wording drift.
- `extension-file-manager`: add the one-shot candidate save path and batch save result reporting alongside the existing CDP capture path.
- `side-panel-media-browser`: add the 抓取本页 action and candidate preview, and state that one-shot capture is not a session and does not enter the session feed.
- `capture-session`: state that one-shot capture is independent and never creates, mutates, or appears in the global capture session.
- `websocket-events`: add `sourceUrl`, `sourceDomain`, and `capturedAt` to the `file:captured` event payload consumed by the library.

## Impact

- `packages/extension/wxt.config.ts`: add `contextMenus` and `scripting` permissions.
- `packages/extension/src/entrypoints/background/index.ts`: register context menus, handle scan/save messages, and report results.
- `packages/extension/src/background/`: new one-shot capture service and page-scan/save logic; reuse `FileManager` for ingestion.
- `packages/extension/src/entrypoints/sidepanel/`: 抓取本页 action, scan preview, selection, progress, and result summary.
- New injected/content-script scanner for DOM candidates and MAIN-world blob extraction.
- `packages/extension/src/shared/extension-runtime.ts`: candidate and batch-save message types.
- Tests for candidate extraction (img/srcset/picture/background/poster), filters, dedupe, data/blob handling, context-menu save, preview selection, and session independence.
- Documentation: README, extension README, and the touched OpenSpec capabilities.
- No new backend storage path and no new host permissions; `saveFile`, AI, archive, and library events remain the single ingest pipeline.
