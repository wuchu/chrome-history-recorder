## 1. Non-blocking image encoding and payload selection

- [x] 1.1 Add a pure `bytesToBase64Chunked` helper that builds each chunk's binary string with `String.fromCharCode.apply` over subarrays and encodes via `btoa` using a multiple-of-3 chunk size
- [x] 1.2 Add an `async` wrapper that `await`s a macrotask (`setTimeout(0)` or `scheduler.yield()`) between chunks, and skips yielding when the buffer is below a small threshold
- [x] 1.3 Replace the per-byte `reduce` + `btoa` in `OllamaClient.callVision` with the new chunked async encoder
- [x] 1.4 Reorder `OllamaClient.getRepresentativeImage` to request the thumbnail before the full original, falling back to the original only when the thumbnail is unavailable

## 2. Tests

- [x] 2.1 Add a unit test asserting chunked output equals a naive whole-buffer base64 encode for byte lengths 0, 1, 2, 3, and a large multi-chunk buffer
- [x] 2.2 Add a unit test asserting the encoder yields to the event loop between chunks (e.g., a flag set from a `setTimeout` callback becomes true before the encode resolves) for a large buffer

## 3. Verification

- [x] 3.1 Run `pnpm test` and `pnpm lint` from the repo root and confirm they pass
- [x] 3.2 Manual check: with AI classification running and a non-empty queue, reload the extension and confirm the Options page and side panel stay interactive during startup processing
