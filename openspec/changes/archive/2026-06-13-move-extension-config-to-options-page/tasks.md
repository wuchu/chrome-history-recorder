## 1. Options Entry Point and Dependency Setup

- [x] 1.1 Add Ant Design dependency to `packages/extension` and update the lockfile.
- [x] 1.2 Create the WXT Options entrypoint under `packages/extension/src/entrypoints/options`.
- [x] 1.3 Wire the extension manifest/options configuration so the Options page is available as `options.html`.
- [x] 1.4 Add Options page bootstrap styling and Ant Design reset/theme setup without importing Ant Design into the DevTools bundle unnecessarily.

## 2. Shared Runtime Message Client

- [x] 2.1 Define shared frontend types for extension config, Ollama models, scheduler status, queue status, and service status responses.
- [x] 2.2 Add a shared runtime-message client for `getConfig`, `updateConfig`, `listOllamaModels`, `checkOllamaHealth`, `getQueueStatus`, `startClassification`, `pauseClassification`, `retryFailedTasks`, and `clearQueue`.
- [x] 2.3 Add reusable hooks for loading config/status and handling save/error/loading states in the Options UI.
- [x] 2.4 Ensure config updates go through Background messages rather than direct `chrome.storage.local` writes for active runtime settings.

## 3. Background Behavior Fixes

- [x] 3.1 Change default extension config so `classificationPaused` defaults to `true`.
- [x] 3.2 Update `initClassifyScheduler` to respect `autoStart` and remain paused when `autoStart` is false.
- [x] 3.3 Ensure paused scheduler enqueue/requeue operations can add pending tasks without claiming them for processing.
- [x] 3.4 Split or adjust Ollama model listing so refresh/discovery returns installed models without persisting a preferred model.
- [x] 3.5 Update startup model handling so an existing configured `visionModel` is not overwritten by automatic discovery.
- [x] 3.6 Ensure explicit `updateConfig({ visionModel })` still applies the selected model to `OllamaClient` immediately.
- [x] 3.7 Ensure classification concurrency updates still apply to the active scheduler.

## 4. Options UI Implementation

- [x] 4.1 Implement the Options page shell with Ant Design layout, typography, cards, feedback messages, and responsive spacing.
- [x] 4.2 Implement the service status card showing VFS and Ollama availability with refresh/reconnect actions where supported.
- [x] 4.3 Implement the Ollama settings card with endpoint input, model select, model refresh, unavailable selected-model warning, and immediate model save on selection.
- [x] 4.4 Implement classification controls with running/paused state, start/pause action, default-paused explanation, and concurrency input.
- [x] 4.5 Implement filename style controls for `filenameStyle` and `filenameStylePrompt`.
- [x] 4.6 Implement queue maintenance controls showing queue counts and providing retry failed and confirm-before-clear actions.
- [x] 4.7 Add user-visible success/error feedback for immediate saves and operational actions.

## 5. DevTools Cleanup

- [x] 5.1 Replace the DevTools embedded configuration section with a visible action that opens the extension Options page.
- [x] 5.2 Remove DevTools configuration form props/state that are no longer used after the Options migration.
- [x] 5.3 Remove legacy DevTools config wiring for proxy endpoint, storage path save, and low-frequency filter forms that no longer belong to the active runtime UI.
- [x] 5.4 Remove unused ConfigSection component/styles or reduce them to the settings shortcut if still needed.
- [x] 5.5 Preserve DevTools media browsing, capture, classification progress, and per-media requeue behavior.

## 6. Validation

- [ ] 6.1 Verify a fresh/default configuration starts with classification paused and does not consume pending tasks automatically.
- [ ] 6.2 Verify captured media can be enqueued while paused and starts processing only after the user starts classification.
- [ ] 6.3 Verify selecting an Ollama model in Options immediately persists and subsequent classification uses that model.
- [ ] 6.4 Verify refreshing Ollama models does not overwrite the configured model.
- [ ] 6.5 Verify DevTools opens Options and no longer renders the old full configuration UI.
- [ ] 6.6 Run extension type checks/build and relevant tests.
- [x] 6.7 Update documentation or screenshots if existing docs describe DevTools as the primary configuration surface.
