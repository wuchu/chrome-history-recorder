## Why

Video capture is declared by the `video-capture` spec and fully supported by the VFS service (blob MIME mapping, ffmpeg thumbnails, `system:video` tagging, stats, playback), but the current CDP capture controller silently drops every non-image response through a hard image-only MIME allowlist. As a result, direct video files seen on pages (for example CivitAI's `<video><source src="…mp4">`) are never stored — only their poster image is. Re-adding video to the allowlist alone is insufficient: media elements request byte ranges, so `Network.getResponseBody` yields a partial, unplayable file, and multi-megabyte bodies cannot be transported as JSON `number[]`.

## What Changes

- Detect direct video responses in the existing CDP capture session (MIME `video/*`, whole-resource responses only) and use the response URL as a download candidate instead of reading the response body.
- Add a robust download pipeline that fetches the **complete** file from its URL in an extension page context (survives MV3 service-worker idle termination and uses the browser's network stack/proxy), then streams it to VFS.
- Add a streaming `POST /upload` endpoint to the VFS HTTP server that writes the body to disk incrementally, computes SHA-256 during the stream, enforces a size cap, deduplicates by content hash, and inserts file metadata plus the `system:video` tag.
- Treat both complete (`200`) and ranged (`206` with `Content-Range`) page responses as download candidates; the pipeline always fetches the URL in full, and a partial response to that full fetch is rejected. MSE (`blob:`) and adaptive multi-segment sites remain out of scope.
- Add video capture configuration: enable/disable video capture, maximum video size, and enabled video formats; expose it in the Options page.
- Reuse the existing post-capture pipeline: broadcast `file:captured` and enqueue the paired classify + rename tasks; classification uses the video's first-frame thumbnail.

## Capabilities

### New Capabilities

- `direct-video-download`: Complete-file download of detected direct video URLs, including the offscreen download context, streaming upload, size enforcement, concurrency, deduplication, and failure reporting.

### Modified Capabilities

- `video-capture`: Replace response-body interception with URL-based detection; define whole-resource eligibility, video-specific size limits, format filtering, and statistics behavior.
- `vfs-http-api`: Add the streaming upload endpoint and its request/response contract, including size and MIME validation.
- `extension-options-config`: Add a video capture settings section for enabling capture, maximum size, and enabled formats.

## Impact

- **Extension**: `packages/extension/src/background/debugger-capture.ts`, new download coordinator and offscreen entrypoint, `background/config-manager.ts`, `shared/extension-runtime.ts`, `entrypoints/options/App.tsx`, `wxt.config.ts` (`offscreen` permission).
- **VFS service**: `packages/vfs-service/src/http-server.ts` (POST route and CORS), `api.ts` (streamed save), `blob.ts` (streaming write / hash).
- **Protocol**: New HTTP `POST /upload`; no WebSocket protocol change.
- **Dependencies**: None added; reuses global `fetch` in the extension and Node HTTP body streaming in VFS.
- **Known limitation**: MSE/blob-based players (e.g. YouTube, Bilibili) are not supported; they require segment stitching and are out of scope. Videos already requested before capture is enabled still require a page reload in this change.
