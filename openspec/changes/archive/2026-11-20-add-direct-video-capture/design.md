## Context

The extension captures page media through `chrome.debugger` (`Network.responseReceived` → `Network.getResponseBody` → VFS `saveFile`). The controller only accepts image MIME types, so video responses are dropped before any candidate is recorded. The VFS service, by contrast, already supports video end to end: MIME/extension mapping, `system:video` tagging, ffmpeg first-frame thumbnails, statistics, listing, and playback.

The naive fix — adding `video/*` to the allowlist — does not produce usable files. Media elements request byte ranges; `Network.getResponseBody` returns whatever slice the page requested, and large bodies are evicted from the CDP resource buffer. Transport is also unfit: `saveFile` serializes bytes as a JSON `number[]`, so a 23 MiB video becomes roughly 80 MiB of JSON and hundreds of megabytes of transient arrays across processes.

Reference case measured on `image.civitai.com` (CivitAI):

- Both `<source>` URLs (`.webm` and `.mp4`) redirect to the same blob.
- The final response is `content-type: video/mp4`, `content-length: 22925673`, `accept-ranges: bytes`.
- `Range: bytes=0-` returns `206` with the complete resource; a bounded range returns a partial resource.
- `access-control-allow-origin: *`; no cookies required.

The `<video>` element uses `preload="metadata"`, so the page never downloads the full file — only its poster image reaches the current capture path.

## Goals / Non-Goals

**Goals:**

- Detect direct video files from the existing CDP capture session and download the **complete** file.
- Store videos in VFS with existing metadata, `system:video` tag, deduplication, and thumbnails.
- Keep the browser's network stack (proxy, redirects, TLS) and survive MV3 service-worker suspension.
- Preserve current image capture behavior and existing post-capture task pipeline.
- Add user configuration for video capture, maximum size, and formats.

**Non-Goals:**

- MSE / `blob:` / adaptive streaming sites (YouTube, Bilibili), which require segment stitching.
- Scanning the DOM for videos already present before capture was enabled (a follow-up change, `harvest-page-videos`).
- Downloading to a user-chosen local folder (`chrome.downloads`).
- Re-encoding, transcoding, or repairing partial video files.
- Replacing the existing image capture path with the new upload endpoint.

## Decisions

### 1. Detection stays in the CDP controller

Reuse `Network.responseReceived`; do not add a content script in this change.

Eligibility rules:

- Capture enabled, video capture enabled, resolved MIME in the configured set (default `video/mp4`, `video/webm`).
- MIME from the response `Content-Type`; fall back to the debugger-reported `response.mimeType` when the header is missing or generic (`application/octet-stream`).
- URL scheme `http:` or `https:`; `blob:` and `data:` are ignored.
- Accept `status === 200`, or `status === 206` with a parseable `Content-Range`. A ranged response still identifies the resource: the pipeline always fetches that URL in full without a `Range` header. The total size from `Content-Range` is used for the size checks. A `206` without a usable `Content-Range` has an unknown total and is skipped.
- Total size within `[minVideoSize, maxVideoSize]`; default minimum 1 MiB, maximum 200 MiB.
- Per-tab URL set deduplicates candidates until navigation or tab close.

Alternatives considered: a DOM scan (`chrome.scripting.executeScript` over `<video>`/`<source>`) detects preloaded videos but introduces an injection surface and SPA lifecycle handling. It is deferred to a follow-up change.

### 2. Downloads run in an offscreen document

The background sends a small message `{ tabId, url, detectedMimeType, sourceUrl, capturedAt }` to an offscreen document, which performs the download and upload.

Alternatives:

- **Service worker fetch**: an in-flight `fetch` does not reset MV3's idle timer, so long downloads can be terminated mid-stream.
- **Side panel**: not guaranteed to stay open; capture is session-scoped, not UI-scoped.
- **VFS server-side fetch**: Node's global `fetch` does not follow the browser's proxy configuration, which matters for sites the browser reaches through a proxy; it also loses browser cookies and session context.

The offscreen document is created on the first candidate and closed after the queue drains and an idle timeout elapses (approximately 60 seconds). A registered reason is required; `BLOBS` is used, with a runtime check that the document starts. The download result is sent back to the service worker, which wakes if suspended.

### 3. Upload is a streaming HTTP POST, not WebSocket JSON

The offscreen document calls `fetch(videoUrl)` without a `Range` header, then pipes `response.body` into `fetch('http://localhost:8766/upload', { method: 'POST', duplex: 'half', body: response.body })`.

Request contract:

- `Content-Type`: the video MIME type observed on the download response.
- `X-Source-Url`: the original page-visible URL (or candidate URL).
- `X-Captured-At`: detection timestamp.
- Raw body, possibly chunked.

The server echoes the request `Origin` (rather than returning a wildcard) and returns `Access-Control-Allow-Private-Network: true` so browser preflights from an extension page to localhost succeed.

The VFS server streams the request to a temporary file while updating a SHA-256 hash, enforces the maximum upload size, then finalizes the blob and metadata. Duplicate content deletes the temp file and returns `{ duplicate: true }`.

If the runtime rejects a streaming request body (observed in some extension-page contexts as a network-level failure), the downloader re-fetches the video into an `ArrayBuffer` and retries the upload as a buffered body under the same size limit. This keeps streaming as the default memory-efficient path while providing a compatibility fallback.

Alternatives: binary WebSocket frames (requires protocol changes and chunk reassembly) and JSON `number[]` (unacceptable memory and payload growth). The HTTP path also gets streaming and backpressure for free.

### 4. Hashing and deduplication are server-side

The extension never hashes the file. The VFS server computes SHA-256 incrementally and uses the existing `{hash}.{ext}` scheme. This keeps memory flat in the extension and makes deduplication identical to the existing `saveFile` path.

### 5. Stored MIME comes from the download response

The reference page declares `video/webm` in `<source>` but the CDN serves `video/mp4`. The system must trust the download response's `Content-Type` for the extension, metadata, and system tag. The detected MIME is used only for eligibility and as a fallback.

### 6. Concurrency, queueing, and reporting

- At most 2 concurrent downloads; additional candidates are queued FIFO.
- Queue and URL-dedupe state are per tab; both clear on navigation or tab removal.
- Success broadcasts `file:captured` and enqueues paired `classify` + `rename` tasks, matching the image path.
- Failures broadcast `capture:error`, increment the failed count, and are not retried automatically.
- Skips broadcast `capture:skipped` with URL and reason.
- Downloads are aborted if the queue is cleared (navigation/tab close).

### 7. Configuration

Add to `ExtensionConfig`:

- `captureVideos: boolean` (default `true`)
- `maxVideoSize: number` (default `200 * 1024 * 1024`, allowed range 1 MiB–2 GiB)
- `enabledVideoTypes: string[]` (default `['video/mp4', 'video/webm']`)

The Options page gains a video section using existing Ant Design controls. Config changes apply to the active capture controller immediately via the existing config-change callback.

## Risks / Trade-offs

- **Chrome requests a bounded range on `preload="metadata"` pages** → confirmed against the reference page: the page's own response is a partial `206`. This is handled: ranged responses are accepted and the pipeline re-fetches the URL in full. A `206` response to the full download request is treated as a failure so a partial body can never be stored.
- **MSE/segment sites produce noise or useless files** → standalone segment responses are small files; the 1 MiB minimum filters most. There is no hard per-page candidate cap (per user request); URL deduplication, the minimum size, and the 2-download concurrency bound the work. Byte-range responses are treated as full-resource URLs, which is the desired behavior even when MSE is serving a single large file. Fully adaptive multi-segment sites remain unsupported.
- **Offscreen reason mismatch** → Chrome may log a warning or reject the document. Mitigation: runtime check; fall back to `WORKERS` if creation fails; surface a capture error.
- **Long downloads on slow connections** → upload may take minutes. Offscreen context is lifetime-safe; the VFS endpoint streams to disk. A stalled-transfer timeout (e.g. 5 minutes of no bytes) aborts and cleans up.
- **Unauthenticated localhost upload endpoint** → only bound to localhost; restrict methods, MIME types, and size; never accept a filesystem path from the client. Any local process could already call the WebSocket API, so this does not expand the trust boundary beyond the existing service.
- **Same content, different URLs** → both are downloaded before hash dedup. Accepted trade-off; URL-level dedup catches the common case (multiple `<source>` entries resolving to one URL after redirect is not known until download, so both may be attempted; the hash check prevents duplicate storage).
- **Extension host permissions** → `<all_urls>` already covers both the media CDN and `http://localhost`, so no manifest host changes are needed; only the `offscreen` permission is added.

## Migration Plan

1. Ship the VFS upload endpoint first; it is additive and unused until the extension is updated.
2. Ship the extension changes with `captureVideos` defaulting to `true` and `maxVideoSize` defaulting to 200 MiB.
3. Existing users' stored `vfsConfig` merges with defaults; no manual migration.
4. Rollback: set `captureVideos: false` or revert the extension; the VFS endpoint is inert when unused.

## Open Questions

- Resolved during implementation: Chrome emits a bounded `Range` request for the reference page's `preload="metadata"` video. The eligibility rule now accepts ranged responses and downloads the complete URL.
- Should detection auto-download every eligible candidate, or require a user action when more than one video is detected on a page?
- Should the new upload endpoint eventually replace the JSON `saveFile` path for images as well?
- What is the right default concurrency on low-bandwidth connections — 2, or configurable in Options?
