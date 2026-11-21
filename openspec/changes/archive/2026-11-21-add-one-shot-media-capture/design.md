## Context

The extension currently captures media in one mode: the user opens the Side Panel, starts a global single-tab CDP capture session, and the background reads `Network.responseReceived` / `Network.loadingFinished` bodies. That path is powerful for continuous recording but heavy for saving one image: it attaches the debugger, shows Chrome's debugging banner, requires a session, and only sees network responses. It explicitly skips `data:` and `blob:` URLs (`debugger-capture.ts`), which are common in modern image editors, canvas apps, and single-page applications.

The storage/ingest side is already generalized: `FileManager.handleCaptureMedia` sends bytes to `saveFile`, the app hashes and stores, the ingest hook enqueues AI/archive tasks, and the app broadcasts `file:captured`. A one-shot capture path can reuse all of that without touching storage, AI, or archive.

The Side Panel already owns capture controls, the current tab identity, and a live session feed. The new action must coexist with the session model without being part of it.

## Goals / Non-Goals

**Goals:**

- Save one image from the page context menu without attaching the debugger or starting a session.
- Scan the current page on demand and preview candidates before saving.
- Support `http(s)`, `data:`, and `blob:` image URLs where the page permits access.
- Reduce noise with size/dimension filters, per-scan caps, and hash dedupe.
- Report per-item results (saved / duplicate / skipped / failed) and never claim a partial batch succeeded.
- Keep one-shot capture independent of the global capture session and its counters/feed.
- Reuse the existing ingest pipeline so AI, archive, and library events are automatic.

**Non-Goals:**

- Site rules, allowlists, or automatic scan/capture.
- HLS/DASH, MSE, or Range-segmented video reconstruction.
- Canvas/WebGL `toBlob` capture.
- Multiple concurrent capture sessions or changes to the CDP capture path.
- Installer, autostart, or backend pairing/authentication.
- A page-level context menu that opens the Side Panel (deferred; the in-panel action covers scanning).

## Decisions

### 1. Two entry points: image context menu and Side Panel scan

- **Image context menu**: `contexts: ['image']`, title "保存图片到媒体库". Clicking it saves `info.srcUrl` directly. This is the lowest-friction path and needs no preview because the user already chose the image.
- **Side Panel action**: a "抓取本页" button visible in both the start state and the active cockpit. It scans the active tab, shows a preview list, and saves selected candidates.

A page-level context menu that opens the Side Panel is deferred because `chrome.sidePanel.open` requires Chrome 116+ and a focused user gesture; the in-panel button is more predictable.

*Alternatives:* A page context menu that directly saves all images gives the user no control and would be surprising; a persistent floating button on every page adds visual noise and permissions surface.

### 2. On-demand `chrome.scripting.executeScript`, not a persistent content script

The scan is injected only when the user acts. It runs in the isolated world to read the DOM and computed styles. `data:` URLs are decoded in the background; `blob:` URLs are fetched by a separate MAIN-world injection because those URLs are owned by the page's JavaScript world.

This keeps the extension idle when not used, avoids a content-script manifest entry on every page, and fits the user-initiated privacy model. `executeScript` results must be JSON-serializable, so the MAIN-world blob extractor returns a data URL string (with a size cap) rather than an `ArrayBuffer`.

*Alternatives:* A persistent content script is simpler to call but runs on every page and makes the "only on user action" guarantee harder to explain. A background `fetch` cannot read `blob:` URLs created by the page.

### 3. Candidate extraction model

The injected scanner returns a bounded list of candidates:

```ts
interface ScanCandidate {
  id: string;                 // kind + resolved URL
  kind: 'img' | 'background' | 'poster';
  url: string;                // absolute http(s), data:, or blob:
  pageUrl: string;
  width?: number;
  height?: number;
  mimeHint?: string;
  sizeHint?: number;
  label?: string;             // alt text or element hint
}
```

Rules:

- `<img>` / `<picture>`: prefer `currentSrc`, then the largest `srcset` candidate, then `src`.
- CSS `background-image`: parse `getComputedStyle(el).backgroundImage`, skip gradients, resolve relative URLs against `document.baseURI`.
- `<video poster>`: include as an image candidate; direct video `src` is not part of this phase.
- Dedupe by resolved URL, then sort by known area descending, then cap at 300.
- Skip candidates with known dimensions under 128×128 and skip `data:image/svg+xml` by default (SVG icons are usually noise). Right-click save can still save an SVG.
- Do not scan inside cross-origin iframes; report that they were skipped.

*Alternatives:* Scanning every element including icons produces hundreds of noise items. Starting from `document.images` plus background styles plus posters covers the common cases with predictable cost.

### 4. Byte resolution differs by URL scheme

- `http(s)`: Background `fetch` with the extension's existing `<all_urls>` host permission. This avoids page CORS restrictions. Check `Content-Type` is `image/*`, enforce a per-item size cap (50 MB), and check the response is not an HTML error page.
- `data:`: Decode the base64 payload in the background; enforce the same cap.
- `blob:`: Execute a MAIN-world function that fetches the blob URL and returns a data URL, capped at 20 MB. If the blob was revoked or the page navigated, report a per-item failure.
- After bytes are resolved, call the existing `FileManager.handleCaptureMedia` with `{ buffer, mimeType, url, capturedAt }`.

Background fetch may fail on hotlink-protected images (missing Referer/cookies). Phase 1 reports that failure clearly; a page-world fallback is a later enhancement.

*Alternatives:* Fetching everything in the page world preserves cookies/referer but is subject to CORS. Fetching everything in the background is simpler and works for most public images.

### 5. Batch save runs in the Side Panel, one candidate at a time with bounded concurrency

The preview owns the selection and progress. It sends one `capture:save-candidate` message per selected candidate to the background, with concurrency 3. This gives natural per-item progress and failure reporting without adding a batch RPC or a progress event protocol. The context menu uses the same single-candidate handler.

*Alternatives:* A background batch endpoint would centralize progress but needs a new progress event channel and cancellation semantics. The Side Panel is the only UI that needs the progress.

### 6. One-shot saves are not sessions

The one-shot path never calls `CaptureSessionStore`, never touches capture counters or the session event log, and never attaches the debugger. It is allowed while a capture session is active. Saved files reach the library through the app's `file:captured` event, exactly like network captures.

The Side Panel preview shows its own result summary; the session feed remains session-scoped.

*Alternatives:* Reusing the session would simplify result display but would make a one-off save look like recording and would entangle session lifecycle. Keeping them separate preserves the existing "session = continuous capture" mental model.

### 7. Noise filters and duplicate reporting

Defaults: minimum 128×128 dimensions for known-size candidates, minimum 1 KB after fetch, maximum 300 candidates per scan. The preview shows the skipped count and reasons. Exact duplicates are detected by the existing hash dedupe; the preview reports "duplicate" rather than "saved". Pixel-identical images at different URLs therefore stay one library item, which matches the content-addressable model.

Phase 1 does not attempt perceptual/near-duplicate detection.

### 8. UI shape

- Add a compact "抓取本页媒体" icon button in the Side Panel top-right status bar; it is visible in both the start state and an active cockpit. It is not duplicated as a text button in the start card.
- The preview is a modal within the side panel: header with counts, a scrollable list of 48×48 thumbnails with dimensions/size/kind, per-item checkboxes, select-all/clear, "保存选中", progress, and a result summary.
- Disable scanning/saving when VFS is disconnected and offer the existing reconnect action.
- After a right-click save, show a toast in the Side Panel if it is open; otherwise set the action badge to a check or error glyph for a few seconds. No `notifications` permission is added.

### 9. Permissions

Add `contextMenus` and `scripting`. Keep `<all_urls>` and `activeTab`. `downloads` is already used by export. `declarativeNetRequest` remains for legacy cleanup only and is not part of this change.

## Risks / Trade-offs

- **Hotlink/CORS failures** → Background fetch covers most public images; per-item failures are reported with an actionable reason. A page-world fallback can be added later.
- **Blob URLs expire on navigation** → Save promptly while the page is alive; report "blob unavailable" if the fetch fails. The context menu path is inherently tied to the current page.
- **Large data/blob payloads** → Cap per item (50 MB http(s), 20 MB blob/data) and per scan (300 candidates); show failures rather than exhausting extension memory.
- **Page CSP blocks injected fetches** → The scanner only reads DOM; byte fetching happens in the background or MAIN world. Report the failing candidate, not the whole scan.
- **Noise from small/icon images** → Default dimension/byte filters and SVG exclusion; the preview lets the user deselect anything that slips through.
- **Cross-origin iframes** → Not scanned in phase 1; the scan result states that iframes were skipped.
- **Service worker idle termination during batch save** → Saves are short per-candidate requests; the Side Panel drives them and can show a per-item timeout/failure.
- **Permission warning** → `scripting` + `<all_urls>` is broad; the feature is user-initiated only, and the UI copy explains that scanning happens only when clicked.

## Migration Plan

1. Add `contextMenus` and `scripting` to the manifest.
2. Register the image context menu on install/startup.
3. Add the scan/save messages and the Side Panel preview.
4. No backend, database, or workspace migration; no existing media changes.
5. Rollback: remove the menu and Side Panel action; saved files remain valid library items. No data cleanup is needed.

## Open Questions

- Should the scan include `canvas` elements via `toBlob` as a best-effort follow-up?
- Should direct `<video src>` (non-HLS) be saved in this phase or deferred to the existing video path?
- Should the preview remember the last selection filters, or default to "all selected" every scan?
- Should one-shot saves be allowed to skip the AI queue for a "quick save" mode?
