## Why

Program configuration is currently embedded in the DevTools panel alongside media browsing, and several controls still behave like transient panel state rather than durable extension settings. Moving configuration to a dedicated Options page gives users a stable settings entry point, fixes confusing Ollama model selection behavior, and makes AI classification startup behavior explicit and safe by default.

## What Changes

- Add a Chrome Extension `options.html` settings page implemented with Ant Design components.
- Move active program configuration out of the DevTools panel and into the Options page.
- Make Ollama model selection persist immediately when the user changes the dropdown value.
- Change Ollama model refresh/discovery so it does not overwrite an explicit user-selected model.
- Make AI classification default to paused for new/default configuration.
- Keep captured media eligible for queueing while classification is paused, but prevent the scheduler from consuming pending tasks until the user starts classification.
- Replace the DevTools embedded configuration section with a lightweight entry point for opening Options.
- Clean up the old DevTools configuration UI and legacy configuration wiring that is no longer part of the active Extension + VFS runtime path.
- Add Ant Design as an extension UI dependency.

## Capabilities

### New Capabilities

- `extension-options-config`: Dedicated Extension Options page for active program configuration, service status, Ollama settings, classification controls, filename style settings, and queue maintenance.

### Modified Capabilities

- `ollama-classifier`: Ollama model discovery and selection semantics change so model selection is immediately persisted by explicit user action, while refresh/discovery remains read-only and does not override user choice.
- `task-queue`: Classification scheduling defaults to paused and only consumes queued tasks after explicit user start, while capture may still enqueue pending tasks.
- `devtools-media-grid`: DevTools no longer embeds the full configuration UI and instead provides access to the dedicated Options page while preserving media browsing and classification progress surfaces.

## Impact

- Affected package: `packages/extension`.
- Affected entrypoints: new Options entrypoint under `packages/extension/src/entrypoints/options`, existing DevTools panel entrypoint cleanup, and `wxt.config.ts` options wiring as needed.
- Affected background modules: Config Manager defaults/application, Ollama model listing/selection message handling, and classification scheduler initialization.
- Affected dependencies: add `antd` to the extension package.
- Affected storage/API: continue using `vfsConfig` as the durable configuration source; reuse existing background messages where possible and adjust model listing to be non-mutating.
- Affected OpenSpec specs: Options configuration, Ollama classifier behavior, task queue scheduler behavior, and DevTools media/config surface behavior.
