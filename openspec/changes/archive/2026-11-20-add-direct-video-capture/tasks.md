## 1. VFS streaming upload endpoint

- [x] 1.1 Add a streaming save path in `packages/vfs-service/src/blob.ts` / `api.ts` that writes the request body to a temporary file while updating a SHA-256 hash, and finalizes it into `blobs/{hash}.{ext}` only when complete.
- [x] 1.2 Implement `POST /upload` in `packages/vfs-service/src/http-server.ts`: parse `Content-Type`, `X-Source-Url`, and `X-Captured-At`; reject missing/unsupported MIME; enforce the maximum upload size while streaming.
- [x] 1.3 On duplicate hash, delete the temporary file and respond `200 { hash, duplicate: true, size, mimeType }` without inserting metadata; on success insert metadata with the matching system tag and respond `200 { hash, duplicate: false, size, mimeType }`.
- [x] 1.4 Clean up temporary files on abort, stream error, size violation, and unsupported MIME; return `400`, `413`, or `415` as specified.
- [x] 1.5 Update CORS handling for `POST` and the custom upload headers, including `OPTIONS /upload` → `204`.
- [x] 1.6 Add a server-side maximum upload size setting (config/constant) defaulting to 200 MiB.
- [x] 1.7 Add Vitest coverage for successful upload, duplicate, oversized stream, unsupported MIME, missing header, and interrupted upload.

## 2. Extension configuration

- [x] 2.1 Extend `ExtensionConfig` in `packages/extension/src/shared/extension-runtime.ts` with `captureVideos: boolean`, `maxVideoSize: number`, and `enabledVideoTypes: string[]`.
- [x] 2.2 Add defaults (`true`, 200 MiB, `['video/mp4', 'video/webm']`) and value validation in `background/config-manager.ts`.
- [x] 2.3 Push configuration changes into the active capture controller so video settings apply without a reload.

## 3. Video detection in the debugger capture controller

- [x] 3.1 Extend CDP response typing to carry `status`, `Content-Range`, and the debugger-reported MIME type.
- [x] 3.2 Resolve the video MIME from `Content-Type`, falling back to `response.mimeType` when the header is missing or generic; match against `enabledVideoTypes`.
- [x] 3.3 Implement eligibility: `200`, or `206` with a parseable `Content-Range` (the full download fetches the complete resource); reject `206` without a usable range, non-2xx statuses, and `blob:`/`data:`/non-HTTP schemes.
- [x] 3.4 Apply video-specific minimum (1 MiB) and configured maximum sizes, broadcasting `capture:skipped` with URL and reason on rejection.
- [x] 3.5 Add per-tab URL deduplication for candidates and clear it on navigation, tab removal, and capture stop.
- [x] 3.6 Forward eligible candidates to the download coordinator instead of calling `Network.getResponseBody` for video.
- [x] 3.7 Add unit tests for eligibility: `200`, full-range and partial `206`, `206` without a content range, non-2xx, generic MIME fallback, blob URL, below minimum, above maximum, disabled formats, and repeated URL.

## 4. Offscreen download pipeline

- [x] 4.1 Add the `offscreen` permission and an offscreen entrypoint (`entrypoints/offscreen/`) that can receive download requests.
- [x] 4.2 Implement a background-side coordinator that creates the offscreen document on first use, forwards candidates, tracks results, and closes the document after the queue drains and an idle timeout elapses.
- [x] 4.3 In the offscreen document, fetch the candidate URL without a `Range` header, follow redirects, and validate a `2xx` response with a supported `video/*` MIME type.
- [x] 4.4 Pipe `response.body` to `POST http://localhost:8766/upload` with `duplex: 'half'` and the required headers; abort on size or stall timeout.
- [x] 4.5 Enforce a concurrency limit of 2 with a FIFO queue; rely on URL deduplication and size limits rather than a per-page candidate cap.
- [x] 4.6 Abort and clean up queued/in-flight downloads when the tab navigates or closes.

## 5. Background integration and reporting

- [x] 5.1 On successful upload, broadcast `file:captured` and enqueue the paired `classify` and `rename` tasks; skip both on duplicates.
- [x] 5.2 Update capture state counters (`captureCount`, `skippedCount`, `failedCount`) and broadcast `capture:state` for video outcomes.
- [x] 5.3 Broadcast `capture:error` with URL and reason on download/upload failure, without automatic retry.
- [x] 5.4 Ensure offscreen completion messages wake a suspended service worker and are processed once.

## 6. Options page video settings

- [x] 6.1 Add a video capture section to `packages/extension/src/entrypoints/options/App.tsx` with an enable switch, maximum-size input, and format selector.
- [x] 6.2 Validate the maximum size (1 MiB–2 GiB) and prevent persisting invalid values.
- [x] 6.3 Persist settings through the existing configuration update path and reflect saved values on load.
- [x] 6.4 Add user-facing labels and error messages for the new section.

## 7. Verification

- [x] 7.1 Run `pnpm test`, `pnpm lint`, and `pnpm format:check` (workspace-wide `format:check` still reports pre-existing unformatted files outside this change; all touched files pass).
- [x] 7.2 Manually verify on the CivitAI reference page: enable capture, reload, confirm the video is stored as `video/mp4`, plays in the detail view, has a first-frame thumbnail and `system:video` tag, and triggers classify + rename.
- [x] 7.3 Confirm a repeated request or duplicate content is reported as duplicate and does not enqueue tasks.
- [x] 7.4 Confirm image capture behavior is unchanged, ranged video responses are downloaded in full, and `206` responses without a usable `Content-Range` are skipped with a visible reason.
