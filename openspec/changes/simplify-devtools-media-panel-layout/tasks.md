## 1. Remove DevTools summary and settings shortcut

- [x] 1.1 Remove `StatsSection` rendering and unused stats formatting props from the DevTools panel shell.
- [x] 1.2 Remove the DevTools Options shortcut UI, `openOptionsPage` handler, and related shortcut/button styles.
- [x] 1.3 Clean up imports, memoized callbacks, and CSS that become unused after removing the summary and shortcut.

## 2. Compact classification progress

- [x] 2.1 Refactor `ClassifyProgressSection` markup into a single compact row with scheduler state, pending/processing/completed/failed counts, and queue action buttons.
- [x] 2.2 Remove the large progress bar, four-card stats grid, and model/language/style config summary from the DevTools classification section.
- [x] 2.3 Update `ClassifyProgressSection` styles to use compact DevTools-native spacing, wrapping safely on narrow panel widths.
- [x] 2.4 Verify existing start, pause, retry failed, and clear queue callbacks still execute from the compact row.

## 3. Convert media grid to natural page scrolling

- [x] 3.1 Remove the fixed 400px grid container height and internal vertical scroll container styling from `VirtualMasonryGrid`.
- [x] 3.2 Move loading and end-of-list indicators into normal document flow rather than absolute positioning inside the old scroll viewport.
- [x] 3.3 Replace the internal div scroll handler with a page/body near-bottom load-more trigger or an equivalent supported Virtuoso window-scroll mechanism.
- [x] 3.4 Ensure `onLoadMore` still respects `hasMore`, `loading`, and repeated near-bottom events without duplicate page requests.

## 4. Validation

- [x] 4.1 Run extension type checks/build and fix any unused import or type errors. (Pre-existing type errors unrelated to changes; no new errors introduced.)
- [x] 4.2 Verify the DevTools panel no longer shows the standalone image/video statistics block.
- [x] 4.3 Verify the DevTools panel no longer shows the bottom Options migration prompt or open-settings button.
- [x] 4.4 Verify the classification progress area appears as a compact row and queue actions still work.
- [x] 4.5 Verify the media grid uses page/body scrolling without nested vertical scrollbars.
- [x] 4.6 Verify scrolling near the page bottom loads additional media when `hasMore` is true.
