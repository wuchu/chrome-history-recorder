## Why

The media browser detail viewer still exposed secondary controls that were no longer desired for original-image viewing, and its title did not clearly identify the renamed image. Service status indicators also used mixed dot implementations, creating inconsistent visual sizing. Feedback handling needed to remain aligned with the Ant Design UI surface instead of using native browser alerts.

## What Changes

- Standardize service status dot rendering so VFS and Ollama connection indicators use the same CSS-sized dot as the service status indicator.
- Simplify the focused image viewer toolbar so original-image viewing no longer shows download or rotate/requeue-style action icons.
- Add a top-left image title in the detail viewer, preferring the AI-renamed filename and falling back to the media hash.
- Require UI feedback to use Ant Design feedback components rather than `window.alert` / native `alert`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `devtools-media-grid`: Refine focused media viewer title and action behavior.
- `side-panel-media-browser`: Keep shared media detail behavior consistent in the Side Panel surface.
- `service-health-monitoring`: Standardize rendered service status indicator sizing.
- `extension-options-config`: Clarify that feedback messages use Ant Design components and not native alerts.

## Impact

- Affected UI components: shared `StatusBar`, shared `MediaDetail`, DevTools media browser, and Side Panel media browser.
- Affected behavior: media detail remains VFS-backed and closeable, but no longer exposes download or requeue/rotate-style toolbar actions.
- No VFS protocol, storage, or Background message changes are required.

