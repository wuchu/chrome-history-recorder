## Context

The active architecture stores captured media in the VFS workspace as content-addressed blob files under `workspace/blobs/`, while SQLite `files` rows provide the metadata index used by list APIs, thumbnails, details, and classification queue references. If a blob exists on disk but its SQLite row is missing, the media is still physically present but invisible to the extension UI and normal VFS queries.

The current duplicate behavior is hash-based: `saveFile()` computes the same truncated SHA-256 content hash used in blob filenames, checks SQLite first, and avoids overwriting existing records. This change adds a manual repair path for the inverse case: existing blob files that need missing index rows.

## Goals / Non-Goals

**Goals:**

- Provide a user-triggered Options page action to sync the current workspace `blobs/` directory into SQLite.
- Insert metadata only for supported image/video blobs whose content hash matches the filename hash and whose hash is not already indexed.
- Preserve all existing indexed records and blob files without overwriting metadata or content.
- Return a useful summary so the Options page can report what happened.
- Keep the feature inside the existing Background runtime message and VFS WebSocket API path.

**Non-Goals:**

- No external directory import flow.
- No filesystem watcher, background polling, or automatic sync on startup.
- No automatic classification queue insertion for synced media.
- No attempt to repair invalid blob filenames by renaming files.
- No schema migration is required.

## Decisions

### Add a dedicated `syncBlobsToIndex` VFS API method

The sync should live in VFS Service because it has direct filesystem access to the workspace and owns SQLite writes. The extension should only trigger the operation and display the result.

Alternative considered: implement scanning in the extension through HTTP downloads or file access. Chrome extension code does not have direct access to the local workspace path, and moving blob scanning outside VFS would duplicate storage knowledge and complicate permissions.

### Scan only `workspace/blobs/` and validate filename hash against content hash

Each blob candidate should be read, hashed with the existing `calculateHash()` rule, and compared to the filename stem. A mismatch means the file is skipped and counted as invalid. This keeps the index tied to the content-addressed storage contract.

Alternative considered: trust filename hashes without reading file contents. That would be faster, but it could index incorrectly named files and later make file retrieval, thumbnail generation, and deduplication behavior misleading.

### Skip existing SQLite rows without mutation

If `files.hash` already exists, the sync counts the blob as an existing item and does not update any row fields. This includes AI-owned metadata, user-owned metadata, soft-delete state, and timestamps.

### Infer MIME type from extension for missing rows

The sync should use the existing extension-to-MIME mapping for supported image/video extensions. Unsupported extensions are skipped. Inserted rows should use default metadata equivalent to a newly saved uncategorized file: `source_url = null`, `category = uncategorized`, no AI fields, no user notes, not deleted.

For `captured_at`, use the blob file mtime as the best local approximation of when the blob entered storage. If stat data is unavailable for a file, count an error and continue scanning other files.

### Do not enqueue synced files for classification

The operation repairs VFS visibility only. Classification remains controlled by existing queue actions and scheduler state.

### Add a simple Options page action and summary

The Options page should add a distinct media index maintenance control with a loading state and feedback message.

## Risks / Trade-offs

- Large blob directories can make sync take noticeable time -> Run the scan as an explicit user-triggered action, keep per-file errors non-fatal, and return counts so the UI can finish with clear feedback.
- Reading every candidate blob is I/O heavy -> The correctness benefit of validating content hash outweighs the cost for a manual repair operation.
- Browser runtime message timeout could be hit for very large workspaces -> Keep the first implementation synchronous but isolated behind a method that can later become job-based if needed.
- MIME inference by extension can miss files with unusual extensions -> Skip unsupported extensions rather than inserting ambiguous binary records.
- Soft-deleted indexed media are skipped because their hash exists -> This preserves non-overwrite semantics, though it means sync does not restore soft-deleted media.
