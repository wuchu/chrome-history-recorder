## Why

AI classification has moved from the old Proxy Plugin plan into the Extension Background + VFS queue architecture, but the DevTools UI still lacks direct controls for model selection, queue processing, and per-image reprocessing. Users need to choose an available local Ollama model, decide when classification/AI filename generation should run, and quickly send specific media back through the AI pipeline.

## What Changes

- Add Ollama model discovery from the configured local endpoint and expose available models in the DevTools configuration UI.
- Add manual start/pause controls for classification processing in the DevTools UI, backed by Background scheduler state.
- Treat "rename" in this change as AI filename metadata generation/update (`ai_filename`), not physical file movement or blob renaming.
- Add quick actions on media items and/or the media detail view to requeue a file for classification and AI filename regeneration.
- Expose existing queue maintenance actions (retry failed, clear queue) in the classification progress UI.
- Emit and consume queue/task status events consistently so the UI reflects pending, processing, completed, failed, running, and paused states.
- Preserve user-owned metadata when AI reprocessing overwrites AI-owned fields.

## Capabilities

### New Capabilities
- `extension-classify-controls`: DevTools and Background controls for Ollama model discovery, scheduler start/pause, queue maintenance, and per-media requeue actions.

### Modified Capabilities
- `ollama-classifier`: Model configuration is expanded from manual model-name entry to endpoint-backed model discovery and selection.
- `task-queue`: Queue behavior is expanded to support user-triggered requeue of completed/failed media and scheduler running/paused control semantics.
- `devtools-media-grid`: Media items gain quick actions for reclassification/AI filename regeneration.

## Impact

- Affected packages: `packages/extension`, `packages/vfs-service`, and OpenSpec specs for classifier, queue, and DevTools media behavior.
- Background messages/API surface will add model listing, scheduler control/status, and requeue operations.
- DevTools Panel UI will add model dropdown controls, queue action buttons, and per-media requeue actions.
- VFS queue APIs may need small extensions for reset/requeue semantics and optional queue event broadcasting.
- No new external dependencies are expected; the change uses the existing local Ollama HTTP API and existing VFS WebSocket API.
- Physical file rename/export is explicitly out of scope for this change.