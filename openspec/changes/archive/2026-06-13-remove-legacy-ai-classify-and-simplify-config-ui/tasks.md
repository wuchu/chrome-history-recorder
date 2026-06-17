## 1. Preflight and Scope Check

- [x] 1.1 Inspect current git status and identify unrelated user changes that must not be reverted
- [x] 1.2 Confirm `packages/extension` and `packages/vfs-service` do not import from `packages/ai-classify`
- [x] 1.3 Search repository references to `ai-classify`, `.ai-classify-*`, CLI specs, and proxy endpoint UI paths to define cleanup targets

## 2. Remove Standalone ai-classify Package

- [x] 2.1 Remove `packages/ai-classify` source, tests, fixtures, package metadata, built output, and nested install artifacts from the workspace
- [x] 2.2 Update workspace lockfile so `packages/ai-classify` is no longer an importer or dependency owner
- [x] 2.3 Remove tooling references that only apply to the removed package, including lint ignore entries for `packages/ai-classify/dist`
- [x] 2.4 Verify root build/test scripts no longer try to run or include removed package tests

## 3. Simplify DevTools Config State and UI

- [x] 3.1 Remove legacy proxy endpoint state, persistence, and save action from the DevTools config hook
- [x] 3.2 Remove storage path form props, handlers, rendering, and proxy HTTP save behavior from the DevTools config UI path
- [x] 3.3 Remove visible image/video capture filter forms from `ConfigSection` while preserving capture defaults for `useNetworkListener`
- [x] 3.4 Remove or de-emphasize theme form UI if it remains outside the simplified configuration surface, while preserving existing automatic/saved theme behavior
- [x] 3.5 Keep VFS/Ollama status display, retry actions, Ollama endpoint/model controls, model discovery, and save AI config behavior intact
- [x] 3.6 Update component prop types, hook return types, imports, constants, and CSS only as needed after removed controls

## 4. Documentation Cleanup

- [x] 4.1 Remove root README references that list `packages/ai-classify` as an active package or CLI entry point
- [x] 4.2 Update README architecture/package descriptions to state that AI classification runs through Extension Background and VFS metadata updates
- [x] 4.3 Remove or update any active docs that instruct users to run `ai-classify` commands
- [x] 4.4 Leave archived OpenSpec history intact unless validation requires otherwise

## 5. OpenSpec Main Spec Alignment

- [x] 5.1 Sync or archive this change so `simplified-devtools-config` is added to main specs
- [x] 5.2 Remove retired standalone CLI requirements from `cli-experience` and `cli-flexible-config`
- [x] 5.3 Remove retired directory watcher and file organizer requirements tied to the CLI package
- [x] 5.4 Replace CLI hash-index requirements with VFS metadata/hash behavior or remove the old capability if no active requirements remain
- [x] 5.5 Narrow `task-queue` requirements to VFS-backed classification queue behavior and remove `ai-classify start` input-directory scanning
- [x] 5.6 Update `devtools-media-grid` and `ollama-classifier` main specs to reflect the simplified DevTools and Extension Background supported behavior

## 6. Validation

- [ ] 6.1 Run TypeScript compile/build for `packages/extension`
- [x] 6.2 Run build/tests for `packages/vfs-service`
- [ ] 6.3 Run repository lint or targeted lint for changed files if available
- [x] 6.4 Run repository tests after package removal and document any skipped tests that belonged to the removed CLI
- [x] 6.5 Search again for active `packages/ai-classify`, `ai-classify start`, `.ai-classify-queue`, `.ai-classify-index`, and proxy endpoint UI references
- [x] 6.6 Verify DevTools configuration still has actionable VFS/Ollama status and AI model controls while removed forms no longer render
