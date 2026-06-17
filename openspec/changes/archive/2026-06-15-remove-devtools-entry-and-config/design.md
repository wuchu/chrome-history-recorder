## Context

The extension has recently migrated its main UI from a Chrome DevTools panel to a Chrome Side Panel (see the `move-capture-ui-to-side-panel` archived change). The Side Panel UI now serves as the primary user interface, making the DevTools panel entry point and related code obsolete.

**Current state:**
- `devtools-panel/` contains shared UI components/hooks used by `media-browser/` and `sidepanel/`
- `media-browser/` is just a re-export layer pointing to `devtools-panel/`
- `sidepanel/main.tsx` imports `i18n.ts` from `devtools-panel/`
- `networkListener.ts` uses `chrome.devtools.network` APIs that are not available in Side Panel

## Goals / Non-Goals

**Goals:**
- Remove unused DevTools entry point and configuration
- Migrate shared UI components/hooks from `devtools-panel/` to `media-browser/`
- Update import paths in affected files
- Clean up unused `networkListener.ts` and related code
- Maintain full functionality of the Side Panel UI

**Non-Goals:**
- Change any UI behavior or functionality
- Modify the Side Panel implementation
- Change any extension API contracts

## Decisions

### 1. Migrate shared assets to `media-browser/`

**Decision:** Move all shared UI components, hooks, i18n, and styles from `devtools-panel/` to `media-browser/`.

**Rationale:** `media-browser/` already serves as the re-export layer; making it the actual source of truth simplifies the architecture.

**Alternatives considered:**
- Create a new `shared-ui/` directory - rejected because it would require more import path changes
- Keep everything in `devtools-panel/` but remove the DevTools entry - rejected because the directory name would be misleading

### 2. Remove DevTools-specific code but preserve shared code

**Decision:** Remove:
- `devtools.html` entry point
- `devtools-panel/App.tsx` (DevTools-specific main component)
- `devtools-panel/main.tsx` (DevTools-specific entry)
- `devtools-panel/constants.ts` (DevTools-specific)
- `devtools-panel/hooks/useNetworkListener.ts` (uses `chrome.devtools.network`)
- `utils/networkListener.ts` (uses `chrome.devtools.network`)
- `utils/networkTypes.ts` (supports networkListener)

Preserve and migrate:
- All other `components/`
- All other `hooks/` (except useNetworkListener)
- `i18n.ts` and `locales/`
- `App.module.css`

### 3. Update import paths incrementally

**Decision:** First migrate the files, then update the import paths in the re-export layers (`media-browser/components.ts`, `media-browser/hooks.ts`, etc.), then update the sidepanel imports.

**Rationale:** This reduces the chance of broken imports during the migration.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Broken imports during migration | Migrate files first, update imports second; verify with TypeScript |
| Accidentally remove code still in use | Review all import paths before deleting; run build/lint |
| Style imports broken | Verify CSS modules import paths after migration |
