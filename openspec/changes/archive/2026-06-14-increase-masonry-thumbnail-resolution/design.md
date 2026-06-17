## Context

The DevTools Panel renders captured media in a virtual Masonry grid with a 200px target column width. VFS already exposes three thumbnail buckets: `small` (100px), `medium` (200px), and `large` (400px). The grid currently uses `medium`, which is only a 1:1 bitmap-to-CSS-pixel match at the intended display width and appears blurry on high-density displays.

## Goals / Non-Goals

**Goals:**

- Make the primary Masonry browsing grid use a thumbnail source with a 2:1 source-to-display ratio.
- Preserve the existing 200px target column width, responsive column calculation, and virtualization behavior.
- Reuse the existing `large` thumbnail bucket instead of adding new VFS API behavior.

**Non-Goals:**

- Changing VFS thumbnail dimensions or cache key semantics.
- Migrating or deleting existing cached `medium` thumbnails.
- Changing compact thumbnail surfaces such as small streams, lists, or status summaries.
- Changing MediaDetail behavior; detail views can continue using full-resolution media where appropriate.

## Decisions

- The Masonry grid SHALL request `size=large` thumbnails for its image preview source. With 200px target columns and 400px source thumbnails, the grid gets the intended 2x density without new backend work.
- The column width remains 200px. Enlarging the card itself would reduce scan density and change the browsing ergonomics; the reported issue is source resolution, not visual layout size.
- VFS thumbnail buckets remain unchanged. Introducing 450px or 800px grid-specific buckets would create cache migration and naming churn for a problem already covered by the existing `large` bucket.
- Existing compact consumers may continue using `small` or `medium`. The new contract applies specifically to the main virtual Masonry grid.

## Risks / Trade-offs

- Higher bandwidth and disk cache usage for first-time grid browsing -> Use the existing 400px bucket only for the main grid and leave compact views unchanged.
- First scroll through older history may generate more `large` thumbnails on demand -> Keep implementation minimal and rely on existing VFS caching.
- Historical items may include precomputed `thumbnailUrl` values pointing to `medium` -> Ensure the Masonry rendering path normalizes or requests the grid-appropriate `large` URL when possible.
