## Context

The extension background is an MV3 service worker with a single thread. It runs a task engine that processes `classify` and `rename` tasks by sending media to a local Ollama instance. `OllamaClient.callVision` encodes the image buffer to base64 with:

```ts
btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''))
```

This is synchronous and per-byte: for each byte it allocates a 1-char string and concatenates, so a large image (up to 50 MB, or the full original when the thumbnail is missing) blocks the service worker for seconds to tens of seconds. A second, larger contributor is `getRepresentativeImage`, which fetches the full original via `getFile` *before* requesting the thumbnail, and the VFS service serializes that Buffer as a JSON `number[]` array (`JSON.stringify` in `websocket-server.ts`), so a 50 MB file becomes a ~200 MB JSON document that `JSON.parse` must materialize synchronously on the service worker thread. When `classificationPaused` is false, the engine auto-resumes at browser startup and drains the backlog, so both of these blocks start immediately after launch and freeze message handling for the Options page, the side panel, and (via CPU/memory saturation) the whole browser.

## Goals / Non-Goals

**Goals:**
- Make vision-request encoding non-blocking so the service worker keeps responding to `chrome.runtime.onMessage`.
- Preserve base64 output correctness (byte-for-byte identical to a naive whole-buffer encode).
- Keep the change localized to the Ollama client encoding path.

**Non-Goals:**
- Changing engine auto-resume semantics (resume-when-running is already specified and intended).
- Changing the Ollama `/api/chat` request format (base64 images in the `images` array are required by the endpoint).
- Downscaling images (a possible future optimization, not required to fix the freeze).

## Decisions

**Decision 1 — Replace the per-byte `reduce` with chunked `String.fromCharCode.apply`.**
Per-byte `reduce` does N string allocations and N function calls; building each chunk's binary string with `String.fromCharCode.apply(null, subarray)` does ~N/32768 allocations. This alone removes the dominant cost.

**Decision 2 — Yield to the event loop between chunks.**
The encoder is `async` and `await`s a macrotask (e.g. `setTimeout(0)` or `scheduler.yield()`) between chunks. This lets queued `chrome.runtime.onMessage` handlers and other macrotasks run, keeping the service worker responsive. `callVision` is already `async`, so this fits the existing call flow.

**Decision 3 — Chunk size is a multiple of 3 and bounded.**
Chunks are sized as a multiple of 3 bytes (so `btoa` per chunk is valid and the pieces concatenate correctly) and kept ≤ 256 KB so each chunk's `fromCharCode.apply` + `btoa` blocks for well under a millisecond.

**Decision 4 — Accept the residual synchronous `JSON.stringify`.**
The request body still stringifies the assembled base64 in one step. Unlike the per-byte `reduce`, this is a single O(n) string copy, so it is bounded to roughly sub-second even for a 50 MB image. This is acceptable and noted as a risk.

**Decision 5 — Prefer the thumbnail over the original for vision requests.**
`getRepresentativeImage` now requests the `large` thumbnail (400 px, cached, tens of KB) first and falls back to `getFile` only when a thumbnail is unavailable. This avoids shipping the full original as a JSON `number[]` array on the common path. The alternative of leaving the full-file fetch first is rejected because it performs the expensive fetch even when a thumbnail is available.

## Risks / Trade-offs

- [Residual `JSON.stringify` block] → bounded, ~sub-second for max-size payloads; acceptable for now, revisit only if profiling shows it matters.
- [Full-size fallback image (50 MB) amplifies encoding] → `getRepresentativeImage` already prefers the `large` thumbnail; capping/downscaling the original is deferred (see Open Questions).
- [Chunked `btoa` correctness] → chunk size is a multiple of 3, and a unit test asserts chunked output equals a naive whole-buffer encode.
- [Yield overhead for small thumbnails] → skip yielding when the buffer is below a small threshold (e.g. < 256 KB) so the common small-image case stays fast.

## Migration Plan

No data or storage migration. Deploy via a normal extension reload. Rollback is reverting `ollama-client.ts`.

## Open Questions

- Should we also cap or downscale the image payload sent to Ollama for very large originals? Deferred — the chunked encoder removes the freeze; a size cap is an additional latency optimization.
