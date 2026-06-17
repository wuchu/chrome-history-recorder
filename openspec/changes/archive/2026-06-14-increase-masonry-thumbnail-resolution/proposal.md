## Why

The DevTools Masonry grid currently displays thumbnails at about 200 CSS pixels wide while using the `medium` thumbnail source whose longest edge is also 200 pixels. On high-density displays this 1:1 source-to-display ratio makes thumbnails look soft or blurry, especially for screenshots and detailed media.

## What Changes

- Update the Masonry grid thumbnail quality contract so 200px grid columns use the existing `large` thumbnail size, whose longest edge is 400px.
- Preserve the existing 200px target column width and responsive column-count behavior.
- Keep VFS thumbnail size buckets unchanged: `small=100`, `medium=200`, `large=400`.
- Keep compact surfaces free to use smaller thumbnails; this change is specifically for the main virtual Masonry browsing grid.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `virtual-masonry-grid`: Require the main Masonry grid to use a thumbnail source at least 2x its target display width, fulfilled by requesting the existing `large` thumbnail for 200px columns.

## Impact

- Affected code: DevTools Panel Masonry grid item rendering and/or historical media thumbnail URL normalization.
- Affected APIs: Existing thumbnail endpoint usage changes from `size=medium` to `size=large` for Masonry grid display; no API shape changes.
- Affected storage: Existing thumbnail cache remains valid; new `large` thumbnails may be generated on demand for grid browsing.
- Dependencies: No new dependencies.
