## REMOVED Requirements

### Requirement: Paired automatic task enqueue

**Reason**: The extension no longer enqueues AI tasks; auto-enqueue on ingest moves to the app.
**Migration**: Covered by `app-task-scheduler`'s "Auto-enqueue on ingest" requirement.

### Requirement: Classification does not write category

**Reason**: This behavior is unchanged but now lives in the `ai` package rather than the extension.
**Migration**: The `ai` package classification handler continues to write tags, confidence, `classified_at`, and `model_used` without setting `category`.

### Requirement: Extension Background manages AI classification

**Reason**: AI classification no longer runs in the Extension Background Service Worker.
**Migration**: The `ai` package runs classify and rename; the `app-task-scheduler` dispatches tasks to it and writes results via `VFSAPI`.

### Requirement: Extension Background provides classification queue management

**Reason**: Queue management moves out of the extension into the app scheduler.
**Migration**: Covered by `task-queue` and `app-task-scheduler`; the Options page routes retry/refresh/clear/start/pause to the app.

### Requirement: Extension Background calls Ollama directly

**Reason**: The Ollama HTTP call moves from the extension to the `ai` package.
**Migration**: Covered by the `ollama-classifier` spec, now hosted in the `ai` package.

### Requirement: Extension Background checks Ollama health

**Reason**: Ollama health checking moves from the extension to the `ai` package in the app.
**Migration**: The `ai` package checks health and the app broadcasts `ollama:status`; the Options page queries it through the app.
