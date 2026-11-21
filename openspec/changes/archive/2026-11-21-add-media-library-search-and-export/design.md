## Context

The Options media library currently lists the first 50 active files and filters by a single tag tab. `ListQuery` supports only `category`, one `tag`, `status`, offset/limit, and a small set of sort fields; there is no text index. New captures are merged from an unbounded Background event array, and the detail view is read-only apart from trash and AI requeue. Downloads are served as `inline` with the hash as the filename, so AI filenames never leave the metadata table.

The storage layer is local SQLite (`better-sqlite3`), with content-addressed blobs and AI metadata in the `files` table. The extension talks to the app over WS RPC plus HTTP for files. There is no native messaging and no cloud dependency, so all search/export work stays local.

This change is self-use first: make a large library navigable and make captured media leave the app with usable names and metadata.

## Goals / Non-Goals

**Goals:**

- Find a known item by text, type, source site, date, tag combination, star, or classification status.
- Act on many items at once: trash, restore, requeue, export.
- Export originals as a zip with an accurate manifest, and download a single file under its AI filename.
- Make live capture stop degrading the library: stable pagination, deduplicated pages, bounded event memory, no scroll stalls.
- Let users curate: star, notes, and add/remove tags without losing AI/system tags.

**Non-Goals:**

- New capture entry points (right-click save, page scan, site rules).
- Installer, autostart, onboarding, or backend pairing/authentication.
- Archive sidecar manifests, archive import, or archive lifecycle changes.
- OCR, embeddings/semantic search, or video Range streaming.
- A full Options i18n refactor; new strings follow the current Options language, with translated defaults where shared components already use `t()`.

## Decisions

### 1. Search: FTS5 with trigram tokenization, LIKE fallback for short queries

Add a standalone `files_fts` FTS5 table over a normalized text field composed of `ai_filename`, `tags`, `source_url`, and `user_notes`. Use `tokenize='trigram'` so Chinese substrings and partial filenames match without a segmenter. Keep the `files` table unchanged.

For queries shorter than the trigram minimum (2 characters, common for Chinese words), fall back to `LIKE '%q%'` on the same normalized text. The FTS table is maintained by triggers on `files` INSERT/UPDATE/DELETE. Backfill runs once during migration.

*Alternatives:* `unicode61` is faster for space-delimited English but treats a Chinese phrase as one token, so substring search fails. A dedicated CJK segmenter adds a dependency and complexity. `LIKE` alone is simple but scans the table and cannot rank.

### 2. Keyset pagination with an opaque cursor

The library uses a cursor of `(sortValue, hash)` encoded as an opaque base64 JSON object. The cursor is validated against the active sort/filter; if it does not match, the first page is returned. Existing offset pagination stays available for compatibility and for the trash/archive paths.

The default sort is `captured_at DESC`; supported sorts are `captured_at`, `size`, `confidence`, and `ai_filename`. Every query includes `hash` as a tiebreaker so pages are stable. Pages are deduplicated by hash on append.

*Alternatives:* Offset-only pagination is simpler but drifts while capture inserts rows, causing duplicates and skips. A pure cursor-only switch would break existing callers; keeping both avoids a flag day.

### 3. Validate queries at the VFS boundary

`orderBy` is resolved through a fixed map of column names; unknown values are rejected. `limit` is clamped to a maximum (500); negative offsets are rejected; cursor payloads are validated. This protects both SQL safety and response size.

### 4. Export runs in the Options page with a streaming zip writer

The extension already holds the metadata for the selected items and can read originals over the existing `GET /files/:hash` endpoint. Export therefore runs client-side:

- fetch each selected blob in sequence (one at a time, with a small concurrency cap for network reads);
- write entries through a streaming zip writer (`fflate`) using a sanitized `ai_filename` plus the real extension, with collision suffixes (`name (2).ext`);
- append `metadata.json` with hash, mime type, size, captured time, source URL, tags, notes, star state, AI filename, confidence, and model;
- report progress after each file (completed / total, current name) and collect missing blobs into an in-memory failure list shown in the UI;
- save the finished archive through `chrome.downloads` (the permission is already declared).

The selection is capped (default 500 files / 1 GB) with a confirmation when the cap is exceeded. A future server-side export job can remove the cap for very large libraries.

Single-file download keeps `GET /files/:hash` but sets `Content-Disposition: attachment` with an RFC 5987 `filename*` using the sanitized AI filename, plus an ASCII fallback. The hash fallback stays when no AI filename exists.

*Alternatives:* A streaming server endpoint avoids tab memory but cannot report per-file progress or a failure list without an additional job/progress channel. Browser-side export has no extra backend surface, gives natural progress, and uses the metadata the UI already has.

### 5. Live state is incremental; the raw event log is bounded

Split the current `events` array into:

- a capped event log (for diagnostics, e.g. 500 entries);
- an incremental live state: `Map<hash, liveItem>`, `Map<hash, classifyStatus>`, and `Set<trashedHash>` updated as events arrive.

`useCombinedMedia` merges the live map with historical items instead of rescanning the whole event history. When any search/filter is active, a `file:captured`/classification event schedules a debounced refresh instead of injecting a live item, so the client does not duplicate server filter logic. Tag vocabulary refreshes only when the latest event is classification/tag-related, debounced.

*Alternatives:* Keeping the full event array and memoizing is simpler but remains O(events × items) per event. Capping the array alone would drop live items that are not yet in the historical page, so incremental maps are required.

### 6. Infinite scroll uses an IntersectionObserver sentinel

Replace the `scroll`/`isNearEnd` latch with a sentinel element observed by `IntersectionObserver`. If the sentinel is still visible after a page finishes loading and `hasMore` is true, the next page is requested. This removes the "loads once, then stalls" behavior on short pages and large screens.

### 7. Multi-select operates on loaded items; bulk RPCs run client-side

Selection is a `Set<hash>` over currently loaded items, with "select visible page" and "clear". "Select all matching" is intentionally deferred because it would require a server-side id-query endpoint and a second confirmation surface.

Bulk trash/restore/requeue loops over the selected hashes with a small concurrency limit (4) and aggregates per-item failures into a result toast. No new batch RPC is introduced in this change. Bulk export runs in the Options page and fetches only the selected hashes.

*Alternatives:* A server-side batch endpoint reduces round trips but adds new API surface, validation, and partial-failure semantics before the UI has proven the workflow.

### 8. Metadata curation uses dedicated, merge-safe VFS methods

Instead of the UI replacing the whole `tags` array (which would race with AI classification and drop `system:*` tags), add:

- `setFileStarred(hash, starred)`;
- `updateFileNotes(hash, notes)`;
- `addFileTags(hash, tags[])` / `removeFileTags(hash, tags[])`.

Each method runs in a transaction, normalizes names, rejects `system:*` input from users, preserves system tags, updates the tag vocabulary (creating user tags with `created_by='user'`), and rebuilds the file tag cache. The existing `updateMetadata` remains for non-tag fields.

*Alternatives:* Reusing `updateMetadata({tags})` is simpler but loses concurrent AI tags and requires every caller to reimplement system-tag merging.

### 9. Filter state persists in sessionStorage

The search/filter/sort state is stored per Options page in `sessionStorage`, so switching console tabs and coming back preserves the view. URL hash routing stays unchanged; filters are not encoded in the hash in this version.

### 10. Repository and UI conventions

The new Options toolbar uses Ant Design components consistent with the console. Shared media components keep their existing `t(key, default)` pattern; new keys get Chinese defaults so the Options page (which does not initialize i18n) renders readable text. Fixing Options i18n is out of scope.

## Risks / Trade-offs

- **FTS5 trigram may be unavailable in an older bundled SQLite** → Detect support at migration time; fall back to a LIKE-only query path and record the capability.
- **FTS triggers add write cost** → The table is small text; trigger maintenance is cheaper than a full rescan. Rebuild in a transaction if the index is ever inconsistent.
- **Keyset cursors can become stale when confidence/ai_filename changes while paging** → Cursor validation returns the first page when the sort/filter changed; duplicate hashes are skipped on append. Acceptable for a local library.
- **Large exports can exhaust Options-tab memory** → Fetch one blob at a time, stream entries through the zip writer, cap the selection, show progress, and allow the user to cancel before saving. Very large libraries should move to a server-side export job later.
- **Client-side file names are untrusted AI output** → Sanitize path separators, control characters, trailing dots/spaces, reserved Windows names, and length; deduplicate collisions; never let a zip entry escape the archive root.
- **Manual tags can race with classification** → All tag mutations are transactional merges that preserve `system:*`; the last write wins for the same user tag.
- **Bulk actions partially fail** → Report per-item failures; do not claim success for the whole selection.
- **SessionStorage may be unavailable** → Reads/writes are guarded; the library still works without persistence.

## Migration Plan

1. Open the database and read `PRAGMA user_version` (0 for existing workspaces).
2. If below the search version, create `files_fts` and its triggers, backfill from `files`, and set the version inside a transaction. The operation is idempotent.
3. Deploy the backend first; existing extension versions keep using offset queries and ignore the new table.
4. Deploy the extension; the new UI uses cursor queries when a search/filter is active.
5. Rollback: the FTS table/triggers are additive and harmless to older binaries; dropping them is safe. No destructive `files` migration is required.
6. Tests: migration from a legacy fixture, FTS backfill count, cursor stability under inserts, export with missing blobs.

## Open Questions

- Should "select all matching" be added in a follow-up once the loaded-item workflow is validated?
- Should the export cap be user-configurable, or fixed at the safe defaults?
- Should filter state later move into the URL hash for shareable console links?
- Should `category` (currently vestigial) be surfaced as a filter or removed in a separate cleanup?
