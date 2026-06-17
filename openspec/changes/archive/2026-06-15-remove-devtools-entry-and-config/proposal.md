## Why

The main UI has been migrated from Chrome DevTools panel to Chrome Side Panel, making the DevTools entry point and related code obsolete. Removing this cleans up the codebase and removes unused DevTools-specific dependencies.

## What Changes

- **Remove**: `wxt.config.ts` `devtools_page` configuration
- **Remove**: `src/entrypoints/devtools.html` entry point
- **Remove**: `src/entrypoints/devtools-panel/` DevTools panel implementation
- **Remove**: `src/utils/networkListener.ts` and `networkTypes.ts` (DevTools network API)
- **Migrate**: Shared components/hooks from `devtools-panel/` to `media-browser/`
- **Update**: Import paths in `sidepanel/` and `media-browser/`

## Capabilities

### New Capabilities

None - this is purely a cleanup/refactor change.

### Modified Capabilities

None - requirements are unchanged, only implementation structure changes.

## Impact

- **Affected code**: `packages/extension/src/entrypoints/` and `packages/extension/src/utils/`
- **No API changes**: Extension runtime behavior remains the same
- **No breaking changes**: Side panel UI continues to work exactly as before
