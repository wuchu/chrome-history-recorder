## Context

The DevTools Panel currently uses a virtual masonry grid for captured media browsing. Each grid item has accumulated classification metadata such as category, generated filename, confidence, tags, status badges, and quick actions. Clicking a grid item opens `MediaDetail`, which behaves like an information panel and may choose `item.url` before the local VFS file URL.

The VFS HTTP API already exposes original captured files at `GET /files/:hash` and thumbnails at `GET /files/:hash/thumbnail?size=...`. The requested behavior can therefore be implemented entirely in the extension UI without changing the VFS service.

## Goals / Non-Goals

**Goals:**

- Make the masonry grid a thumbnail-first browsing surface with no category, filename, confidence, or tag text on image tiles.
- Make thumbnail click open a focused large-image viewer rather than a metadata-heavy details panel.
- Ensure the large image always loads from the local VFS original file endpoint using the media hash.
- Preserve essential viewer actions: close, download, and requeue classification/renaming when available.

**Non-Goals:**

- No changes to VFS HTTP endpoints, thumbnail generation, blob storage, or database schema.
- No new third-party image viewer dependency.
- No implementation of zoom, pan, keyboard next/previous navigation, delete, tag editing, or video playback in this change.
- No change to thumbnail generation size or list loading strategy.

## Decisions

1. Use the existing `MediaDetail` component as the viewer implementation point.

   Rationale: `App` already owns selected media state and renders `MediaDetail` as the click target. Reworking this component keeps the change localized and avoids introducing a parallel modal stack.

   Alternative considered: Add a separate `ImageViewer` component and leave `MediaDetail` intact. This would preserve the old details UI, but it would duplicate selection state and keep the product surface split between two competing detail experiences.

2. Build the viewer image URL from `buildVfsFileUrl(item.hash)` unconditionally.

   Rationale: The local VFS file is the captured artifact the extension controls. Source URLs can be remote, slow, expired, blocked, or different from the captured bytes.

   Alternative considered: Prefer `item.url` for real-time items and VFS URLs for historical items. This keeps some previous behavior, but it reintroduces the performance and reliability issue for any item that carries a source URL.

3. Keep grid tiles as semantic buttons containing only thumbnail state.

   Rationale: A button is keyboard-focusable by default and accurately represents the click action. Removing metadata reduces layout churn and improves visual scanning.

   Alternative considered: Keep the wrapper as a `div` with `onClick`. That preserves existing markup but gives weaker keyboard semantics.

4. Move requeue access out of the grid tile and keep it in the viewer toolbar.

   Rationale: Pure thumbnail tiles should not show secondary actions. The viewer is the place where the user has selected an item and can intentionally reprocess it.

   Alternative considered: Keep hover quick actions on the tile. This conflicts with the thumbnail-only grid requirement and makes accidental activation more likely.

## Risks / Trade-offs

- Loss of at-a-glance classification metadata in the grid -> Tag filtering and queue/progress sections remain available; metadata-heavy browsing can be revisited as a separate, explicit details drawer if needed.
- Existing specs and tests may expect metadata on cards -> Update `devtools-media-grid` requirements to make thumbnail-only cards the intended behavior.
- Viewer actions use text symbols instead of a dedicated icon library -> Keep the toolbar small and accessible through titles; a later UI polish pass can introduce a shared icon system.
- Full original images may be large -> This is intentional for large-image viewing; the grid still uses thumbnails for browsing.
