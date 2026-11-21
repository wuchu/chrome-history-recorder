## 1. Manifest, shared types, and injection plumbing

- [x] 1.1 Add `contextMenus` and `scripting` to the extension manifest permissions.
- [x] 1.2 Add shared one-shot capture types (candidate, scan result, save result, error reasons) to `shared/extension-runtime.ts`.
- [x] 1.3 Add a helper that injects the DOM scanner into the active tab with `chrome.scripting.executeScript` and returns typed candidates.
- [x] 1.4 Add a MAIN-world blob extractor that fetches a blob URL and returns a size-capped data URL.
- [x] 1.5 Add unit tests for the message/type contracts and injection helper.

## 2. Page scanner

- [x] 2.1 Implement the pure DOM scanner for `<img>`/`<picture>` using `currentSrc` and the largest `srcset` candidate.
- [x] 2.2 Collect CSS `background-image` URLs from computed styles; skip gradients and non-image values.
- [x] 2.3 Collect `<video poster>` candidates.
- [x] 2.4 Resolve relative URLs against the page base URL and normalize the candidate identity.
- [x] 2.5 Apply the 128×128 dimension filter, 1 KB byte filter, SVG exclusion, URL dedupe, area sort, and 300-candidate cap.
- [x] 2.6 Report skipped counts and cross-origin iframe skips in the scan result.
- [x] 2.7 Add jsdom tests for img/srcset/picture/background/poster extraction, normalization, filters, dedupe, cap, and iframe reporting.

## 3. Background one-shot save pipeline

- [x] 3.1 Implement the `http(s)` candidate save path with Background `fetch`, `image/*` validation, and the 50 MB per-item cap.
- [x] 3.2 Implement the `data:` candidate decode path with the same size cap.
- [x] 3.3 Implement the `blob:` candidate path through the MAIN-world extractor with the 20 MB cap and expired-blob reporting.
- [x] 3.4 Add a per-item timeout and map failures to stable reasons (fetch, MIME, size, expired blob, restricted page, VFS disconnected).
- [x] 3.5 Call the existing `FileManager.handleCaptureMedia` / `saveFile` path with bytes, MIME type, source URL, and capture time.
- [x] 3.6 Return a typed per-item result with hash, duplicate flag, and error reason; never abort the remaining selection on one failure.
- [x] 3.7 Add tests for http/data/blob success, duplicate, MIME rejection, size limit, timeout, and expired blob.

## 4. Context menu

- [x] 4.1 Register the image context menu ("保存图片到媒体库") idempotently on install/startup.
- [x] 4.2 Handle the context-menu click by resolving `info.srcUrl` and invoking the one-shot save path.
- [x] 4.3 Send a success/failure toast to the Side Panel when open; otherwise set the action badge briefly.
- [x] 4.4 Add tests for menu registration, context-menu save, duplicate handling, and restricted pages.

## 5. Side Panel scan action and preview

- [x] 5.1 Add the 抓取本页媒体 top-right icon so it is available with or without an active session.
- [x] 5.2 Add scan loading, empty, error, and VFS-disconnected states with the existing reconnect action.
- [x] 5.3 Implement the preview modal with thumbnails, known dimensions/size, source kind, and per-item checkboxes.
- [x] 5.4 Add select-all, clear-all, and toggle behavior with a selected/total count.
- [x] 5.5 Implement batch save with concurrency 3, per-item progress, and a saved/duplicate/skipped/failed summary.
- [x] 5.6 Ensure closing the preview discards the candidate list and does not touch the global library.
- [x] 5.7 Add component tests for scan states, selection, batch progress, result summary, and reconnect gating.

## 6. Session independence and event alignment

- [x] 6.1 Ensure the one-shot path never calls `CaptureSessionStore` or changes session counters/event log.
- [x] 6.2 Ensure a one-shot save is allowed while another tab's capture session is active and does not stop it.
- [x] 6.3 Add `sourceDomain` to the app's `file:captured` payload (or derive it consistently) so the event matches the updated spec.
- [x] 6.4 Add tests that one-shot saves appear in the library but not in the session feed/counters.
- [x] 6.5 Add tests for context-menu feedback with the Side Panel open and closed.

## 7. Documentation and verification

- [x] 7.1 Update `README.md` and `packages/extension/README.md` with right-click save, 抓取本页, data/blob support, and session independence.
- [x] 7.2 Update `ARCHITECTURE.md` with the one-shot capture path and its relationship to the CDP session.
- [x] 7.3 Run `pnpm lint`, `pnpm test`, and `pnpm build`; fix any failures.
- [x] 7.4 Manually verify: right-click save, page scan, select/save, duplicate reporting, data URL, blob URL, VFS disconnected, and one-shot capture while a different tab is recording.
