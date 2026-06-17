## 1. Background Ollama Model Discovery

- [x] 1.1 Add Ollama model list types and response normalization in `ollama-client.ts`
- [x] 1.2 Implement `OllamaClient.listModels()` using `GET {endpoint}/api/tags` with timeout and error handling
- [x] 1.3 Add Background message handler for `listOllamaModels`
- [x] 1.4 Ensure model discovery uses current `ConfigManager` endpoint and reports failures without changing selected model
- [ ] 1.5 Add or update tests/manual checks for healthy Ollama, unavailable Ollama, and empty model list scenarios

## 2. Scheduler Control and Queue Events

- [x] 2.1 Extend `ClassifyScheduler` with explicit running/paused state methods for start, pause, and status
- [x] 2.2 Change pause behavior so no new pending tasks are claimed while active tasks may finish
- [x] 2.3 Persist scheduler startup preference or paused state through `chrome.storage.local`
- [x] 2.4 Add Background message handlers for starting, pausing, and querying classification control status
- [x] 2.5 Emit task start, task completed, task failed, queue updated, and scheduler state events from Background/Scheduler
- [x] 2.6 Ensure queue status responses include scheduler running/paused state for UI consumption

## 3. Requeue Semantics in VFS and Background

- [x] 3.1 Review current VFS `enqueueClassification` behavior for existing queue rows and decide whether to update or replace rows
- [x] 3.2 Add a clear requeue/reset path for existing completed or failed queue entries
- [x] 3.3 Ensure requeue rejects hashes that do not exist in VFS
- [x] 3.4 Add Background handler for per-media requeue with elevated priority
- [x] 3.5 Verify reprocessing overwrites only AI-owned metadata and preserves user-owned fields
- [x] 3.6 Add or update VFS/API tests for completed-item requeue, failed-item requeue, and missing-hash rejection

## 4. DevTools Configuration UI

- [x] 4.1 Extend config hook/state to load and save Background `vfsConfig` fields used by AI controls
- [x] 4.2 Add Ollama endpoint input, refresh models action, model dropdown, and selected model persistence to `ConfigSection`
- [x] 4.3 Display model discovery loading, empty, and error states
- [x] 4.4 Keep current configured model visible even if model discovery fails
- [x] 4.5 Add localized labels for Ollama endpoint, refresh models, model selection, and discovery errors

## 5. DevTools Queue Control UI

- [x] 5.1 Extend `useClassifyQueue` return state with scheduler running/paused status and start/pause actions
- [x] 5.2 Wire `retryFailed` and `clearQueue` actions into `ClassifyProgressSection`
- [x] 5.3 Add start/pause control button and state display to `ClassifyProgressSection`
- [x] 5.4 Require confirmation before destructive clear-queue action
- [x] 5.5 Refresh queue status after start, pause, retry, clear, and scheduler events

## 6. Media Requeue Quick Actions

- [x] 6.1 Add reclassify/regenerate AI filename action to `MediaDetail`
- [x] 6.2 Add hover/focus quick action to media cards in `MasonryItem` or the active grid item component
- [x] 6.3 Wire quick actions to Background requeue message and show success/error feedback
- [x] 6.4 Update combined media state from requeue/task events so cards show pending or processing status
- [x] 6.5 Ensure quick action click does not unintentionally open the detail view when invoked from a card

## 7. Documentation and Legacy Clarification

- [x] 7.1 Document that rename in this workflow means `ai_filename` metadata update, not physical blob rename
- [x] 7.2 Update relevant README/UI text that still refers to Proxy/3777 for AI classify controls where touched
- [x] 7.3 Document manual scheduler behavior, including pause allowing active tasks to finish
- [x] 7.4 Document Ollama model dropdown behavior and non-vision model caveat

## 8. Validation

- [x] 8.1 Run typecheck/build for affected packages
- [x] 8.2 Run VFS service tests for queue and API behavior
- [ ] 8.3 Manually test with VFS connected and Ollama running: discover models, select model, start processing, pause processing, requeue item
- [ ] 8.4 Manually test Ollama unavailable: model discovery failure and paused queue UI remain usable
- [ ] 8.5 Manually test VFS disconnected: queue controls and requeue actions show actionable failures
- [x] 8.6 Verify no physical files are renamed, moved, exported, or deleted by classify/rename actions
