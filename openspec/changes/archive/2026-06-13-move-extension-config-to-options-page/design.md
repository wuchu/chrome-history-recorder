## Context

The extension currently exposes program configuration inside the DevTools panel through plain React form controls. That panel mixes active Extension + VFS runtime configuration with older DevTools-local or legacy proxy/CLI settings. The Background service worker already owns the durable `vfsConfig` object and exposes runtime messages for config, Ollama health/model discovery, classification start/pause, queue status, retry, and clear operations.

Two behavior gaps motivate the architecture change:

- Ollama model discovery currently has side effects: startup and `listOllamaModels` may auto-select and persist a preferred model, which can override a user-selected dropdown value.
- Classification startup passes `autoStart` from `classificationPaused`, but scheduler initialization currently starts unconditionally and the default configuration is not paused.

This change introduces a dedicated extension Options page as the canonical settings surface and turns DevTools back into a media browsing/capture surface with a settings shortcut.

## Goals / Non-Goals

**Goals:**

- Provide a dedicated `options.html` settings entrypoint implemented with Ant Design.
- Make `vfsConfig` the source of truth for active program configuration.
- Persist Ollama model selection immediately when the user changes the model dropdown.
- Make Ollama model refresh/discovery read-only with respect to saved model selection.
- Default AI classification processing to paused while allowing capture to continue enqueueing pending tasks.
- Remove full configuration forms from DevTools and clean up legacy config wiring that is no longer part of the active runtime path.
- Reuse existing Background messages where possible so Options and DevTools do not import Background internals.

**Non-Goals:**

- Reintroducing or preserving the standalone `packages/ai-classify` CLI configuration surface.
- Changing VFS database schema or blob storage layout.
- Changing media capture/deduplication semantics beyond where captured media is already enqueued for classification.
- Adding cloud AI providers or non-Ollama model providers.
- Physically renaming files on disk; AI filename generation remains metadata-oriented.

## Decisions

### Use Extension Options as the canonical configuration UI

Create a WXT options entrypoint under `packages/extension/src/entrypoints/options` and wire it through WXT/manifest options behavior. The page will use Ant Design components for forms, cards, status tags, switches, queue statistics, and feedback messages.

Alternatives considered:

- Keep configuration in DevTools and restyle it with Ant Design. This would preserve the overloaded panel boundary and keep settings hidden behind DevTools.
- Add a second Options page but keep full DevTools settings. This creates duplicate configuration surfaces and more synchronization burden.

### Communicate with Background through runtime messages

The Options page should use `chrome.runtime.sendMessage` for `getConfig`, `updateConfig`, `listOllamaModels`, `checkOllamaHealth`, `getQueueStatus`, `startClassification`, `pauseClassification`, `retryFailedTasks`, and `clearQueue`. Shared frontend helpers/hooks may be extracted so DevTools and Options can share message contract types without importing Background implementation modules.

Alternatives considered:

- Read/write `chrome.storage.local` directly from Options for all settings. This bypasses ConfigManager side effects such as applying Ollama client config, DNR sync, and scheduler concurrency updates.
- Import Background modules directly. This does not fit extension runtime boundaries.

### Make Ollama model discovery non-mutating

Model listing should only fetch and normalize installed Ollama models. It should return the current configured model and, optionally, a recommended model for display, but it must not persist a replacement model unless the user explicitly selects it. Startup may initialize defaults from `DEFAULT_CONFIG`, but it must not override a saved user model just because another installed model is preferred.

Alternatives considered:

- Continue auto-selecting a preferred model whenever discovery runs. This optimizes first-run setup but causes user selections to appear ignored.
- Auto-switch when the configured model is missing. This can hide a real configuration problem; the UI should instead show that the selected model is not installed/available.

### Persist model selection immediately

The Options model `Select` change handler should send `updateConfig({ visionModel })` immediately. On success, the Background ConfigManager persists to `vfsConfig` and applies the model to OllamaClient. On failure, the UI should show an error and either restore the previous value or mark the form as unsaved/error.

Alternatives considered:

- Save the whole form only when the user clicks a submit button. This is familiar for forms, but the requested behavior is immediate model effectiveness and avoids the current misleading dropdown experience.

### Default scheduler processing to paused

Change `DEFAULT_CONFIG.classificationPaused` to `true` and make `initClassifyScheduler` respect `autoStart`. Captured media may still enqueue tasks. When paused, `enqueue()` may create pending queue entries and broadcast queue updates, but `processQueue()` should not claim tasks until the scheduler starts.

Alternatives considered:

- Disable auto-enqueue while paused. This would make “pause” mean “do not collect work,” but the requested behavior is a paused processing state rather than a disabled queue.
- Keep auto-running for backwards compatibility. This surprises users and can start local AI work without an explicit user decision.

### Replace DevTools config with a settings shortcut

The DevTools panel should remove the full embedded configuration section. It may keep a compact button or link that calls `chrome.runtime.openOptionsPage()` and may continue to show classification progress/status where relevant to the media workflow.

Alternatives considered:

- Keep a small subset of config in DevTools. This weakens the “single settings entrypoint” model and risks divergent behavior.

## Risks / Trade-offs

- Ant Design increases the extension bundle size → Use Ant Design only in the Options entrypoint where possible and avoid pulling it into DevTools unless needed.
- Immediate model persistence can create frequent config writes if users quickly change selections → Model changes are low-frequency; show loading/disabled state while saving to prevent rapid overlapping writes.
- Non-mutating discovery can leave an unavailable model selected → Surface a clear warning in Options and let the user choose an installed model.
- Paused-by-default may make users think classification is broken → Show the paused state, pending counts, and a clear “Start classification” action in Options and/or classification progress surfaces.
- Removing DevTools configuration may disrupt users who expect settings there → Provide an obvious “Open Settings” entry point in DevTools.

## Migration Plan

1. Add Ant Design dependency to `packages/extension`.
2. Add the Options entrypoint and wire manifest/options behavior.
3. Extract or add shared frontend runtime-message helpers for config/status/queue operations.
4. Implement Options sections for service status, Ollama settings, classification controls, filename style, and queue maintenance.
5. Update Background behavior:
   - default `classificationPaused` to `true`,
   - make scheduler initialization respect `autoStart`,
   - make model listing non-mutating,
   - ensure explicit config updates still apply to OllamaClient and scheduler concurrency.
6. Replace DevTools configuration forms with an Options shortcut and remove stale config hook state/actions.
7. Verify new installs start paused and existing user `vfsConfig` values are preserved.

Rollback strategy: Because configuration remains stored in `vfsConfig`, rolling back UI changes should not require data migration. If the Options page fails, DevTools can temporarily regain the old config section or direct storage editing can preserve existing settings.

## Open Questions

- Should Options expose all capture filter defaults after DevTools cleanup, or should those remain hidden defaults until a separate capture-settings change?
- Should the first-run model field remain `llava:7b` from defaults, or should Options show an explicit “recommended model” action when installed models are first discovered?
