## 1. Masonry Thumbnail Source

- [x] 1.1 Update the Masonry grid image thumbnail source so grid items request or normalize to `size=large` instead of `size=medium`.
- [x] 1.2 Preserve the existing 200px target column width, responsive column calculation, lazy loading, and item metadata rendering behavior.

## 2. Verification

- [x] 2.1 Verify the code path for historical items and fallback thumbnail URLs both produce `large` thumbnails for the main Masonry grid.
- [x] 2.2 Run targeted validation for the extension package, such as type checking, linting, or the narrowest available workspace check.
