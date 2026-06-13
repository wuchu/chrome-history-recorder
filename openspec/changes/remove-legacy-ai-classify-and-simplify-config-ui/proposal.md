## Why

The project has converged on the Chrome Extension Background + VFS Service architecture, but legacy standalone CLI and old configuration surfaces still remain in the repository and DevTools UI. This creates confusing product boundaries, duplicated AI classification concepts, and settings that no longer match the current runtime path.

## What Changes

- **BREAKING**: Remove the standalone `packages/ai-classify` CLI package from the workspace.
- Remove stale documentation and workspace references that present `ai-classify` as a supported product entry point.
- Simplify the DevTools configuration UI by removing low-value or legacy form controls that are not part of the current core capture/classify workflow.
- Remove the legacy proxy endpoint/storage-path save path from the DevTools config hook and UI wiring.
- Keep Extension Background AI classification, Ollama model discovery/selection, queue controls, and per-media requeue actions as the supported AI workflow.
- Preserve runtime defaults for capture filters when their UI controls are removed, so media capture behavior remains predictable.
- Update OpenSpec main specs to retire standalone CLI requirements and align configuration behavior with the Extension + VFS architecture.

## Capabilities

### New Capabilities

- `simplified-devtools-config`: DevTools configuration behavior after removing legacy and low-frequency form controls.

### Modified Capabilities

- `cli-experience`: Standalone `ai-classify` CLI user experience is retired and no longer a supported requirement.
- `cli-flexible-config`: Standalone CLI configuration modes are retired and no longer a supported requirement.
- `directory-watcher`: Directory watching behavior owned by the standalone CLI is retired.
- `file-organizer`: Filesystem organization behavior owned by the standalone CLI is retired.
- `hash-index`: Legacy CLI hash-index files are retired as product requirements.
- `task-queue`: Queue requirements are narrowed to the Extension/VFS classification queue and no longer describe CLI event-log behavior.
- `devtools-media-grid`: DevTools configuration surface is simplified while preserving media browsing and requeue actions.
- `ollama-classifier`: Supported Ollama configuration is scoped to Extension Background configuration and DevTools model controls, not standalone CLI configuration.

## Impact

- Affected packages: `packages/ai-classify` removal, `packages/extension` DevTools config cleanup, workspace/lockfile updates.
- Affected documentation: root README, package list, any references that describe `ai-classify` as an active CLI tool.
- Affected OpenSpec specs: CLI/directory/file-organizer/hash-index/task-queue requirements that currently document retired standalone CLI behavior.
- No new runtime dependencies are expected.
- Existing Extension Background classification modules remain in place under `packages/extension/src/background/classify/`.
- Existing VFS queue/database/blob behavior remains the storage and metadata source of truth.