## 1. VFS schema, migration, and search index

- [x] 1.1 Add a schema-version constant and migration runner using `PRAGMA user_version`; run migrations inside a transaction when the database opens.
- [x] 1.2 Create the `files_fts` FTS5 table over `ai_filename`, `tags`, `source_url`, and `user_notes`, using the trigram tokenizer when available.
- [x] 1.3 Add INSERT/UPDATE/DELETE triggers that keep `files_fts` in sync with `files`.
- [x] 1.4 Backfill `files_fts` from existing rows during migration; make the migration idempotent.
- [x] 1.5 Detect FTS5/tokenizer availability and record a degraded-search capability flag used by the query path.
- [x] 1.6 Add tests for migration from a legacy database, backfill counts, trigger updates, and re-open idempotency.

## 2. VFS media query API

- [x] 2.1 Extend `ListQuery` with `q`, `mimeType`, `sourceDomain`, `capturedFrom`, `capturedTo`, `starred`, `classifyStatus`, `tags[]`, `tagMode`, and `cursor`.
- [x] 2.2 Add `ai_filename` and `size` to the supported sort fields and keep `hash` as the tiebreaker.
- [x] 2.3 Implement free-text matching through FTS5, with a LIKE substring fallback for short queries and degraded builds.
- [x] 2.4 Implement structured filters and combine them with the text query.
- [x] 2.5 Implement multi-tag AND/OR filtering against the JSON tag cache, including system-tag forms.
- [x] 2.6 Implement source-domain extraction from `source_url` and add a bounded `getSourceDomains(limit)` API.
- [x] 2.7 Implement cursor pagination with an opaque validated cursor and return `nextCursor`; keep offset pagination working.
- [x] 2.8 Validate `orderBy` through a fixed column map, clamp `limit`, reject negative/non-finite offsets, and add tests for each rejection.
- [x] 2.9 Expose the new query fields and `getSourceDomains` through `VFSAPI` and the WS dispatcher.
- [x] 2.10 Add tests for text search (English/Chinese substrings), each filter, multi-tag modes, sorting, cursor stability under inserts, and offset compatibility.

## 3. VFS merge-safe metadata curation

- [x] 3.1 Add `setFileStarred(hash, starred)` that updates `is_starred` and syncs `system:starred` in one transaction without dropping other tags.
- [x] 3.2 Add `updateFileNotes(hash, notes)` and refresh the search index.
- [x] 3.3 Add `addFileTags(hash, names[])` that normalizes names, rejects `system:*`, preserves existing tags, and creates user tags with `created_by = 'user'`.
- [x] 3.4 Add `removeFileTags(hash, names[])` that removes only user tags and preserves system tags.
- [x] 3.5 Update tag usage counts incrementally for tag additions/removals where practical, without changing existing classification behavior.
- [x] 3.6 Expose the new methods through `VFSAPI` and the dispatcher.
- [x] 3.7 Add tests for star sync, notes/index updates, tag add/remove/skips/reserved names, and races with classification writes.

## 4. VFS HTTP download naming

- [x] 4.1 Add a shared filename sanitizer (path separators, control characters, trailing dots/spaces, Windows reserved names, length cap).
- [x] 4.2 Build the download name from `ai_filename` plus the real extension, falling back to `<hash>.<ext>`.
- [x] 4.3 Set `Content-Disposition: attachment` with an RFC 5987 `filename*` and an ASCII fallback, plus `X-Content-Type-Options: nosniff`.
- [x] 4.4 Add HTTP tests for AI-name downloads, hash fallback, sanitization, and header injection attempts.

## 5. Extension runtime plumbing

- [x] 5.1 Extend the shared `VFSFileMetadata`, list-query, and response types with the new filters, sort fields, cursor, `nextCursor`, source domains, star state, and notes.
- [x] 5.2 Extend `vfs-ws-client` with the new list query, `getSourceDomains`, `setFileStarred`, `updateFileNotes`, `addFileTags`, and `removeFileTags` calls.
- [x] 5.3 Add Background message handlers for each new RPC and return typed results.
- [x] 5.4 Add `fflate` to `packages/extension/package.json` and wire the dependency into the Options bundle.
- [x] 5.5 Add or update unit tests for the new client/handler contracts.

## 6. Media library search, filters, and sort UI

- [x] 6.1 Add a debounced search input to the Media Library header.
- [x] 6.2 Add a filter bar with type, source site, captured-date range, classification status, and starred controls.
- [x] 6.3 Add a sort selector for newest, oldest, largest, smallest, confidence, and AI filename.
- [x] 6.4 Add an all-tags picker with search, counts, pinned state, multi-select, and AND/OR mode; keep tag tabs as single-tag shortcuts.
- [x] 6.5 Reset pagination and re-query when any search/filter/sort/tag input changes.
- [x] 6.6 Persist search/filter/sort/tag state in `sessionStorage` for the Options page session.
- [x] 6.7 Show filter-aware empty states with a "clear filters" action, and the capture CTA for an empty library.
- [x] 6.8 Disable backend-dependent controls while disconnected and refresh the query/tag counts after reconnect.
- [x] 6.9 Add hook/component tests for filter state, query params, and empty states.

## 7. Multi-select and batch actions

- [x] 7.1 Add selection state and selection-mode entry/exit to the Media Library.
- [x] 7.2 Add selection controls and selected visuals to masonry items without triggering the detail view.
- [x] 7.3 Add "select visible", "clear selection", and selected-count display.
- [x] 7.4 Implement batch trash with bounded concurrency, success removal, and partial-failure reporting.
- [x] 7.5 Implement batch classify/rename requeue with partial-failure reporting.
- [x] 7.6 Add batch trash/requeue controls and confirmations to the selection toolbar.
- [x] 7.7 Add selection and batch action tests, including partial failures and scroll stability.

## 8. Detail curation and navigation

- [x] 8.1 Add star/unstar UI and persistence to the detail view, with grid/detail state sync.
- [x] 8.2 Add editable notes with save state and error handling.
- [x] 8.3 Add a tag editor that adds/removes user tags, supports creating user tags, and preserves system tags.
- [x] 8.4 Add a download-original action that uses the server download endpoint.
- [x] 8.5 Add previous/next controls and left/right keyboard navigation over the current filtered order.
- [x] 8.6 Add tests for curation actions, navigation bounds, and keyboard handling.

## 9. Client-side zip export

- [x] 9.1 Implement a streaming export pipeline that fetches selected originals over HTTP one at a time and writes them through `fflate`.
- [x] 9.2 Generate the sanitized, collision-suffixed entry names from `ai_filename`/hash plus the real extension.
- [x] 9.3 Build `metadata.json` from the selected items with all required fields, matching included entries only.
- [x] 9.4 Report per-file progress (completed/total, current name) and collect missing-blob failures without aborting.
- [x] 9.5 Enforce the export cap (item count and estimated size) with a clear refusal message.
- [x] 9.6 Save the completed archive through `chrome.downloads` with a dated filename.
- [x] 9.7 Add cancellation that stops fetching and does not save a partial archive.
- [x] 9.8 Add tests for naming, collisions, sanitization, manifest/archive consistency, missing blobs, cap, and cancellation.

## 10. Live state, pagination, and performance

- [x] 10.1 Split the Background event stream into a capped diagnostic log and incremental live item/status/trash maps.
- [x] 10.2 Update `useCombinedMedia` to merge the incremental live maps instead of rescanning the event history.
- [x] 10.3 When filters are active, debounce a query refresh for capture/classification events instead of injecting live items.
- [x] 10.4 Trigger tag count/vocabulary refresh only from the latest classification/tag event, debounced.
- [x] 10.5 Add a request-generation token to `useHistoricalImages`, discard stale responses, and deduplicate appended pages by hash.
- [x] 10.6 Replace the scroll latch with an IntersectionObserver sentinel and request the next page while the end region remains visible.
- [x] 10.7 Verify header totals stay consistent with live inserts and filtered queries.
- [x] 10.8 Add tests for event-buffer bounds, incremental status, stale responses, deduplication, and scroll latch recovery.

## 11. Documentation and verification

- [x] 11.1 Update `README.md` and `packages/extension/README.md` with search, filters, selection, export, and download naming.
- [x] 11.2 Update `ARCHITECTURE.md` with the FTS index, cursor pagination, curation RPCs, and client-side export flow.
- [x] 11.3 Run `pnpm lint`, `pnpm test`, and `pnpm build`; fix any failures.
- [ ] 11.4 Manually verify: search Chinese/English, combine filters, multi-tag AND/OR, sort, select/trash/restore/requeue, export zip + manifest, single download name, star/notes/tags, reconnect refresh, and long-capture scrolling.
