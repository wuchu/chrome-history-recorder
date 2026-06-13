## Context

The active product path is now the Chrome Extension DevTools Panel backed by Extension Background modules and the VFS Service. Media capture, queueing, AI classification, and metadata updates are handled by `packages/extension` and `packages/vfs-service`.

The repository still contains `packages/ai-classify`, a standalone CLI that watches directories, stores `.ai-classify-*` files, organizes output folders, and presents its own terminal UI. That package is no longer used by the Extension/VFS runtime path, but it remains in the workspace, lockfile, README, tests, and OpenSpec main specs. The DevTools configuration UI also retains old configuration surfaces such as storage path/proxy saving and low-frequency capture filter forms.

## Goals / Non-Goals

**Goals:**

- Make the Extension + VFS workflow the only supported product entry point.
- Remove the standalone `ai-classify` CLI package and its workspace/test/documentation references.
- Simplify DevTools configuration UI to avoid presenting obsolete or low-value form controls.
- Keep AI classification available through Extension Background scheduler, Ollama client, queue controls, model discovery, and requeue actions.
- Keep media capture defaults stable even when filter controls are no longer user-facing.
- Retire OpenSpec requirements that describe standalone CLI behavior.

**Non-Goals:**

- Rewriting Extension Background classification internals.
- Removing Ollama support from the Extension.
- Removing classification queue controls, model selection, or per-media requeue actions introduced by `enhance-extension-classify-controls`.
- Migrating user-owned standalone CLI configuration files from disk; the CLI is being retired rather than replaced by a compatible CLI.
- Changing VFS blob storage layout or physically renaming saved media files.

## Decisions

### Remove the CLI package instead of extracting shared code

`packages/ai-classify` will be removed from the workspace. Shared extraction is not needed because the active runtime already has Extension-native classifier and scheduler modules, and keeping a shared library would preserve the old product boundary.

Alternative considered: keep `ai-classify` as an offline utility. This keeps duplicate configuration, queue, hash-index, and file-organization concepts alive and continues to confuse which workflow is supported.

### Keep Extension Ollama controls, remove legacy storage/proxy controls

The DevTools UI will keep controls that operate the current classifier path: VFS/Ollama status, model discovery/selection, scheduler start/pause, retry failed, clear queue, and per-media requeue. The storage path save path and internal proxy endpoint state will be removed because they target the older HTTP/proxy configuration model rather than the current Background/VFS path.

Alternative considered: remove all AI configuration UI. This would make classification harder to operate and would conflict with the current model discovery/control workflow.

### Replace capture filter forms with defaults unless actively needed by runtime

Image/video minimum size and video MIME type defaults should remain available to the network listener, but the low-frequency form controls can be removed from the main DevTools UI. If runtime code still needs these values, it should source constants or stored defaults without rendering edit forms.

Alternative considered: keep the forms but collapse them. This reduces visual noise less and still suggests these settings are central to the product.

### Treat OpenSpec CLI capabilities as retired requirements

Main specs that exist only to describe the standalone CLI should be marked removed by this change. Specs that also describe active Extension/VFS behavior should be narrowed to the active behavior rather than deleted wholesale.

Alternative considered: leave historical specs unchanged. That would make future proposal/apply work reintroduce retired CLI concepts.

## Risks / Trade-offs

- Retiring the CLI may surprise users who used it as an offline directory classifier → Mitigation: mark it as BREAKING in proposal, remove README entry, and make the Extension/VFS path explicit.
- Removing filter UI may reduce flexibility for advanced capture tuning → Mitigation: keep sane defaults in constants/storage and avoid changing capture behavior as part of the UI cleanup.
- OpenSpec spec cleanup can be broad and conflict with existing incomplete changes → Mitigation: update only main specs during apply and leave archived changes as history unless required for validation.
- Package removal can leave stale lockfile or ignore references → Mitigation: include workspace, lockfile, README, eslint, tests, and scripts in the removal checklist.
- Current working tree already contains unrelated OpenSpec deletions and README edits → Mitigation: implementation should inspect current git status and avoid reverting unrelated user changes.

## Migration Plan

1. Remove `packages/ai-classify` source, tests, package metadata, built artifacts, fixtures, and nested dependencies from the repository.
2. Regenerate or update workspace lockfile so `packages/ai-classify` no longer appears as an importer.
3. Remove root README package references and CLI usage references that describe `ai-classify` as active.
4. Remove tooling references that only existed for `packages/ai-classify`, such as lint ignore entries for its dist output.
5. Simplify DevTools config types, hook state, component props, and rendered form controls.
6. Ensure capture defaults still flow to `useNetworkListener` after form removal.
7. Run extension typecheck/build and repository tests that remain after package removal.
8. Update main OpenSpec specs during archive/sync so retired CLI requirements no longer describe active behavior.

Rollback is straightforward at source-control level: restore the removed package and README/spec references from git if the CLI must be supported again.