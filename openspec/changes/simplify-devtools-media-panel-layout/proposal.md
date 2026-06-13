## Why

The DevTools media panel currently presents too much management-oriented summary information before the media grid, which reduces the visible browsing area. The media grid also uses a fixed-height internal scroll container, creating nested scrollbars instead of letting the DevTools panel page scroll naturally.

## What Changes

- Remove the standalone image/video statistics summary section from the DevTools panel.
- Convert the AI classification progress section into a single compact row that preserves core queue status and actions without the large progress/stat/config layout.
- Remove the bottom Options-page migration prompt and DevTools "open settings" shortcut; users can open Options through the browser extension menu.
- Change the media grid scrolling model to avoid a fixed internal scroll area and use the page/body scroll for media browsing.
- Preserve media tabs, capture controls, service status, media cards, detail view, requeue behavior, and loading-more behavior.

## Capabilities

### New Capabilities

### Modified Capabilities
- `devtools-media-grid`: Simplify DevTools panel layout requirements by removing the standalone statistics section and Options shortcut, compacting classification progress, and requiring natural page scrolling for the media grid.
- `virtual-masonry-grid`: Update scrolling and classification progress requirements so the masonry grid no longer owns a fixed-height internal scrollbar and the classification progress UI is compact.

## Impact

- Affected UI components under `packages/extension/src/entrypoints/devtools-panel`:
  - `App.tsx` and `App.module.css`
  - `StatsSection` usage and related styles
  - `ClassifyProgressSection` component and styles
  - `VirtualMasonryGrid` component and styles
- No new runtime APIs, storage keys, dependencies, or background protocols are required.
- Existing Options page remains available through Chrome extension Options entrypoints rather than an in-panel DevTools shortcut.
