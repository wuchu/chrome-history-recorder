## ADDED Requirements

### Requirement: Paired automatic task enqueue
The system SHALL enqueue independent `classify` and `rename` tasks when a new media file is captured, without coupling their lifecycle.

#### Scenario: Enqueue both task types on capture
- **WHEN** a non-duplicate media file is captured and saved to VFS
- **THEN** Background SHALL enqueue a `classify` task and a `rename` task for its hash
- **AND** each enqueue SHALL be idempotent per `(task_type, target_hash)`

#### Scenario: Failure isolation
- **WHEN** a `classify` task fails for a hash
- **THEN** the `rename` task for the same hash SHALL remain independently scheduled
- **AND** vice versa

#### Scenario: Independent requeue
- **WHEN** the user requeues one task type for a hash
- **THEN** the other task type SHALL NOT be reset

### Requirement: Classification does not write category
The system SHALL NOT write the legacy `category` field when classification completes.

#### Scenario: Complete classification
- **WHEN** a classification task succeeds
- **THEN** Background SHALL update tags, confidence, `classified_at`, and `model_used`
- **AND** it SHALL NOT set `category`

## MODIFIED Requirements

### Requirement: Extension Background manages AI classification
The Extension Background Service Worker SHALL coordinate typed AI tasks by calling the Ollama API and updating VFS metadata through type-specific handlers.

#### Scenario: Enqueue file for classification
- **WHEN** a file is captured and saved to VFS
- **THEN** Background SHALL enqueue `classify` and `rename` tasks for image and video files according to configuration

#### Scenario: Process classification task
- **WHEN** the engine claims a `classify` task
- **THEN** Background SHALL obtain a representative image, call the Ollama vision API with the tag vocabulary prompt, parse generated tags, canonicalize near-synonyms, and update VFS tags

#### Scenario: Process rename task
- **WHEN** the engine claims a `rename` task
- **THEN** Background SHALL obtain a representative image, call the Ollama vision API with the naming prompt, and update the VFS display filename

#### Scenario: Handle classification failure
- **WHEN** the Ollama API returns an error or times out
- **THEN** Background SHALL record the failure, increment attempts, and retry according to the task retry policy

#### Scenario: Preserve user-owned metadata
- **WHEN** an AI task completes for a file that already has user metadata
- **THEN** Background SHALL overwrite only the task-type-owned AI fields
- **AND** it SHALL preserve `is_starred`, `user_notes`, and deletion state

### Requirement: Extension Background provides classification queue management
The Extension Background Service Worker SHALL manage typed task queue status and provide retry, refresh, pause, and clear operations through the unified task engine.

#### Scenario: Get queue status
- **WHEN** the UI requests queue status
- **THEN** Background SHALL return overall and per-task-type counts plus engine state

#### Scenario: Retry failed tasks
- **WHEN** the user retries failed tasks
- **THEN** Background SHALL reset failed tasks to `pending` and trigger the engine

#### Scenario: Refresh tasks
- **WHEN** the user refreshes a single file or triggers a full rescan
- **THEN** Background SHALL requeue the targeted tasks as `pending`

#### Scenario: Clear queue
- **WHEN** the user clears the queue
- **THEN** Background SHALL remove queue entries without deleting media or user metadata

### Requirement: Extension Background calls Ollama directly
The Extension Background Service Worker SHALL call the Ollama HTTP API directly for image and video task processing.

#### Scenario: Call Ollama chat API with image
- **WHEN** Background processes a `classify` or `rename` task for an image
- **THEN** Background SHALL POST to `{ollamaEndpoint}/api/chat` with the configured model, user message content, and base64 image, with `stream: false`

#### Scenario: Call Ollama chat API with video frame
- **WHEN** Background processes a task for a video
- **THEN** Background SHALL use a representative frame obtained through VFS thumbnails before calling Ollama

#### Scenario: Parse classification result
- **WHEN** Ollama returns a response for a classification task
- **THEN** Background SHALL parse generated tags, including new-tag markers and canonical vocabulary names
- **AND** it SHALL fall back to conservative parsing when the response is malformed
