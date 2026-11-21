## Why

The Options media library is now the product's main surface, but it only offers a tag tab bar over the first loaded page. Users cannot find a known capture (no text search, date/site/type filters, or sort), cannot act on more than one item, and cannot get files out of the app with a meaningful name. The current offset pagination also duplicates or skips items while capture is running, and the unbounded background-event buffer makes long sessions progressively slower. The library stops being an asset library at exactly the point it becomes valuable: when it gets large.

## What Changes

### Query and storage

- Extend `ListQuery` with:
  - free-text `q` over `ai_filename`, tags, `source_url`, and `user_notes`;
  - `mimeType` (image / video), `sourceDomain`, `capturedFrom` / `capturedTo`, `starred`, and `classifyStatus` filters;
  - multi-tag selection with `tags[]` plus `tagMode: 'and' | 'or'`;
  - sort by `captured_at`, `size`, `confidence`, or `ai_filename`;
  - cursor (keyset) pagination, while keeping offset pagination for existing callers.
- Add an FTS5 index kept in sync with `files`, plus a schema-versioned migration so existing workspaces upgrade automatically.
- Runtime-validate `orderBy` against a whitelist and clamp `limit` / `offset`; reject negative offsets.
- Add a single download helper that produces `ai_filename` + real extension, falling back to `<hash>.<ext>`.

### Options media library

- Add a search input, filter bar (type, source site, date range, tags, classification status, starred), sort selector, and an "all tags" picker so vocabularies larger than the tab bar are reachable.
- Add multi-select mode with a selection toolbar: batch trash, batch requeue (classify / rename), and batch export.
- Extend the trash page with selected-item restore and purge alongside the existing global actions.
- Extend media detail with: star/unstar, editable notes, add/remove tags (reusing the vocabulary, allowing user-created tags), download original, previous/next navigation, and keyboard arrow support.
- Improve live consistency: refresh after VFS reconnect, dedupe appended pages by hash, keep the header total in sync with live items, and show a useful empty state.
- Cap the background-event buffer, derive classify/trash state incrementally instead of rescanning all events, trigger tag refresh from the latest event only, and fix the infinite-scroll latch that stalls when the viewport is already at the bottom.

### Export

- Add a client-side export flow in Options: fetch the selected originals over the existing HTTP file endpoint, build a zip with a streaming zip writer, and save it through `chrome.downloads`. The extension already has the metadata for the selected items, so the zip and manifest are assembled without a new backend job.
- The archive contains the original blobs named from `ai_filename` (with a collision-safe suffix) plus a `metadata.json` manifest with hash, mime type, size, captured time, source URL, tags, notes, star state, and classification metadata.
- Batch export reports per-file progress (completed / total and current name), skips missing blobs into an explicit failure list, and caps the selection to a safe size so the Options tab cannot exhaust memory.
- Change the single-file download response to advertise the AI filename and the real extension instead of `inline; filename="<hash>"`.

### Explicitly out of scope

- Capture entry points (right-click save, page scan, site rules).
- Backend installer / autostart / onboarding.
- WebSocket/HTTP pairing authentication and Origin allowlisting.
- Archive sidecar manifest, archive import, and archive lifecycle changes.
- OCR, embeddings, semantic search, and video Range streaming.

## Capabilities

### New Capabilities

- `media-library-export`: client-side selected-media zip export, manifest contents and naming, single-file download naming, collision handling, per-file progress and failure reporting.

### Modified Capabilities

- `options-media-library`: search/filter/sort controls, multi-select and batch actions, detail curation actions, empty state, reconnect refresh, live-list consistency.
- `vfs-service`: extended `ListQuery`, FTS5 index and migration, cursor pagination, runtime query validation, and the supporting API surface.
- `vfs-http-api`: download filename/headers derived from the AI filename.
- `multi-tag-filtering`: single-tag filtering becomes multi-tag AND/OR, with an all-tags access path.
- `virtual-masonry-grid`: multi-select mode, stable/deduplicated incremental pages, and a corrected infinite-scroll latch.
- `trash-management`: batch trash and selected-item restore/purge semantics.
- `tag-management`: user-assigned tags and user-created tags alongside the AI-owned vocabulary.
- `system-tags`: manual star/unstar while keeping the `system:starred` tag consistent.

## Impact

- `packages/vfs/src/sqlite.ts`: FTS5 table/index, schema migration, extended `ListQuery`, cursor query, order/limit validation.
- `packages/vfs/src/api.ts` and `dispatcher.ts`: expose the new query fields, export helpers, and metadata updates through the existing API/WS contract.
- `packages/vfs/src/http-server.ts`: downloadable filename, sanitization, and attachment headers for single-file downloads.
- `packages/extension/src/entrypoints/options/` new export flow: fetch originals, build the zip/manifest with `fflate`, report progress, and save via `chrome.downloads`.
- `packages/extension/src/entrypoints/options/components/MediaLibrary.tsx`, `TrashPage.tsx`, `media-filter.ts`, and new toolbar/filter/selection components.
- `packages/extension/src/entrypoints/media-browser/components/MediaDetail.tsx`, `VirtualMasonryGrid.tsx`, `MasonryItem.tsx`, and related styles.
- `packages/extension/src/entrypoints/media-browser/hooks/useBackgroundMessaging.ts`, `useCombinedMedia.ts`, `useHistoricalImages.ts`.
- `packages/extension/src/shared/extension-runtime.ts`, `background/vfs-ws-client.ts`, `background/index.ts` for metadata and export RPCs.
- `packages/extension/src/entrypoints/options/hooks/useOptionsData.ts` / `useTaskQueue.ts` where filter state and batch actions are coordinated.
- Tests under `packages/vfs/test/`, `packages/extension/test/`, plus new query/migration/export tests.
- Documentation: `README.md`, `ARCHITECTURE.md`, `packages/extension/README.md`, and the relevant `openspec/specs/`.
- Dependencies: `fflate` (small streaming zip writer) in `packages/extension`. FTS5 ships with the bundled SQLite, so no new database engine.
- No BREAKING API removals; existing offset-based `listFiles` callers keep working with validated defaults.
