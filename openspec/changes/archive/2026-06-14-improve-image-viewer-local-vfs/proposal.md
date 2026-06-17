## Why

The DevTools media browser currently mixes thumbnail browsing with classification metadata, making the image grid noisy and reducing scan speed. Opening an image can also use the original source URL instead of the locally captured VFS file, causing slow or unreliable large-image viewing even when the file is already stored locally.

## What Changes

- Simplify image grid items so they display only the media thumbnail and basic loading/error states.
- Replace the metadata-heavy media detail panel with a focused image viewer optimized for viewing the large image.
- Ensure the image viewer always loads the original captured file from the local VFS HTTP endpoint (`/files/:hash`) instead of source URLs from the original page.
- Keep essential viewer actions available, including close, download, and requeue for AI classification/renaming where supported.
- Remove grid-card quick metadata displays such as category, generated filename, confidence, and tag chips from the thumbnail browsing surface.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `devtools-media-grid`: Change thumbnail card and media detail behavior to prioritize pure thumbnail browsing and local VFS-backed large image viewing.

## Impact

- Affected UI components: DevTools media grid item rendering, virtual masonry grid props, and media detail/viewer modal.
- Affected behavior: thumbnail clicks open a viewer backed by local VFS original file URLs, not remote source URLs.
- No VFS HTTP API changes are required because the existing `/files/:hash` endpoint already serves original captured files.
- No new dependencies are required.
