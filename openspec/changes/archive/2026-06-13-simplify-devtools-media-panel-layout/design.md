## Context

The DevTools panel currently combines media browsing with several management surfaces: a standalone image/video statistics block, a large AI classification progress section, and a bottom prompt that links to the extension Options page. The media grid is rendered inside a fixed-height 400px container with its own vertical scrollbar, which can create nested scrolling alongside the page/body scrollbar.

The desired direction is for DevTools to prioritize media browsing: keep the essential status and actions visible, make classification state compact, remove persistent configuration migration messaging, and let the panel page naturally scroll through media content.

## Goals / Non-Goals

**Goals:**
- Reduce vertical space used above and below the media grid.
- Remove the standalone `StatsSection` from the DevTools panel.
- Render AI classification queue status/actions as a single compact row.
- Remove the DevTools Options-page shortcut and migration prompt.
- Replace the media grid's fixed internal scrolling region with page/body natural scrolling.
- Preserve infinite loading, media tabs, media item click/detail behavior, and per-media requeue behavior.

**Non-Goals:**
- Reworking the Options page itself.
- Removing Chrome's extension Options entrypoint.
- Changing background message protocols, queue semantics, or persisted configuration.
- Redesigning Masonry item cards or media detail content beyond what is required for the scroll/layout change.
- Adding new statistics, filters, or settings controls.

## Decisions

### Remove the standalone statistics section instead of collapsing it

`StatsSection` duplicates information that is either already available in the media tabs or less important for the primary browsing workflow. Removing the section gives the largest immediate space reduction and keeps the top of the panel focused on status, capture, classification, tabs, and media.

Alternative considered: convert `StatsSection` into a one-line summary. This would preserve more metrics, but it still consumes vertical space and keeps management-oriented data prominent.

### Convert classification progress to a compact bar

The classification section should keep operational controls and queue visibility, but the progress bar, four large stat cards, and config summary should be removed from the default layout. A compact row can show scheduler state, pending/processing/completed/failed counts, and the existing actions (`start`/`pause`, retry failed, clear queue) without dominating the viewport.

Alternative considered: remove the classification section entirely and leave all controls to Options. This would maximize space but would also remove useful inline queue controls from the media workflow.

### Remove DevTools Options shortcut entirely

The bottom settings shortcut is a migration prompt rather than a durable media browsing feature. The Options page remains reachable through Chrome's extension Options entrypoint, so the DevTools panel should not reserve permanent space for this message or button.

Alternative considered: replace the prompt with a small icon button. This still adds configuration affordance to a panel that is being simplified around media browsing.

### Prefer page/body scrolling for the media grid

The media grid should no longer own a fixed-height internal scroll container. The grid container should participate in normal document flow, and loading/end indicators should be document-flow elements rather than overlays anchored to an internal viewport.

Because infinite loading currently depends on the internal scroll container, the load-more trigger must move to either:
- a Virtuoso/window-scroll mechanism if supported by the installed masonry component, or
- a window scroll listener that detects when the page is near the document bottom.

The implementation should choose the simplest option compatible with the current `@virtuoso.dev/masonry` version and verify that additional pages still load.

## Risks / Trade-offs

- **Virtualized masonry may expect an explicit scroll viewport** → Verify the installed masonry API and test rendering/loading after removing the fixed 400px container. If window scrolling is not supported cleanly, use a minimal window-scroll near-bottom listener while preserving virtualization behavior as much as possible.
- **Removing `StatsSection` hides detailed capture statistics** → Media counts remain visible in tabs, and detailed operational configuration/status remains in Options or compact queue state.
- **Compact classification controls may wrap on narrow DevTools widths** → Use flex wrapping and small DevTools-native control styling so the row remains usable at narrow widths.
- **Removing the Options shortcut conflicts with an active options-migration change** → Update the DevTools media grid spec delta in this change to supersede that requirement and make the browser extension Options entrypoint the expected path.
