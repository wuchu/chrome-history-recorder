# Extension Classify Controls

## Purpose

Define DevTools controls for starting, pausing, maintaining, and requeueing Extension Background AI classification work.

## Requirements

### Requirement: DevTools exposes queue maintenance actions

The extension SHALL expose queue maintenance actions for failed and queued AI tasks from the Options page, routed to the app and scoped to a task type.

#### Scenario: Retry failed tasks
- **WHEN** the user clicks retry failed tasks in an AI task card
- **THEN** the Options page SHALL request the app to retry failed queue entries of that task type
- **AND** the app SHALL reset failed tasks for eligible media of that type to pending
- **AND** failed tasks for ineligible media SHALL become skipped instead of pending
- **AND** queue status SHALL refresh after the operation
- **AND** the interface SHALL expose the skipped count and reasons

#### Scenario: Clear a task type's queue
- **WHEN** the user clicks clear queue in an AI task card and confirms the action
- **THEN** the Options page SHALL request the app to clear queued tasks of that type
- **AND** it SHALL NOT clear tasks of other types
- **AND** queue status SHALL refresh after the operation

#### Scenario: Full rescan a task type
- **WHEN** the user confirms a full rescan in an AI task card
- **THEN** the Options page SHALL request the app to requeue media only for that task type
- **AND** queue status SHALL refresh after the operation

### Requirement: DevTools exposes Ollama model selection
The extension SHALL allow users to discover and select installed Ollama models from the dedicated Options page, queried through the app.

#### Scenario: Load available models
- **WHEN** the user opens the AI configuration area or clicks refresh models
- **THEN** the Options page SHALL request the model list via the Background relay from the app
- **AND** the app SHALL query the configured Ollama endpoint for installed models
- **AND** the Options page SHALL display returned model names as selectable options

#### Scenario: Save selected model
- **WHEN** the user selects an Ollama model
- **THEN** the Options page SHALL update app configuration with the selected model
- **AND** future classification tasks SHALL use that model

#### Scenario: Handle model discovery failure
- **WHEN** the configured Ollama endpoint is unavailable or returns an invalid model list
- **THEN** the Options page SHALL keep the current configured model value
- **AND** it SHALL show an actionable error or unavailable status

### Requirement: Media quick actions requeue AI processing
The extension SHALL provide quick actions that requeue a specific media item for classification and AI filename regeneration, routed to the app.

#### Scenario: Requeue media from detail view
- **WHEN** the user clicks reclassify or regenerate AI filename for an eligible media item
- **THEN** the Side Panel SHALL send that media hash through the Background relay to the app for requeue
- **AND** the app SHALL enqueue the hash for classification with elevated priority
- **AND** the media item SHALL show a pending or queued status after the operation

#### Scenario: Requeue media from grid quick action
- **WHEN** the user invokes a requeue quick action from a media card
- **THEN** the same requeue behavior SHALL apply as the detail view action

#### Scenario: Requeue ineligible media shows a reason
- **WHEN** the user requeues a media item whose format cannot be processed by the AI pipeline
- **THEN** the app SHALL return the ineligibility reason
- **AND** the interface SHALL show an actionable message explaining that the format is not supported
- **AND** the media item SHALL show a skipped status rather than a queued status

#### Scenario: Preserve user-owned metadata during reprocessing
- **WHEN** requeued AI processing completes
- **THEN** the system SHALL overwrite AI-owned fields such as `ai_filename`, `tags`, `confidence`, `classified_at`, and `model_used`
- **AND** it SHALL preserve user-owned fields such as `is_starred` and `user_notes`

### Requirement: Rename means AI filename metadata generation
The extension SHALL define rename controls in this workflow as AI filename metadata generation, not physical file renaming.

#### Scenario: Generate AI filename without physical rename
- **WHEN** a classify and rename task completes
- **THEN** the system SHALL update the media item's ai_filename metadata
- **AND** it SHALL NOT rename, move, export, or delete the underlying hash-addressed blob file

### Requirement: DevTools exposes per-task scheduler controls

The extension SHALL allow users to start and pause each AI task type independently from the dedicated Options page, routed to the app scheduler.

#### Scenario: Start a task type
- **WHEN** the user clicks the start control in the AI 分类 or AI 重命名 card
- **THEN** the Options page SHALL send a per-type start request through the Background relay to the app
- **AND** the app SHALL mark only that task type as running
- **AND** pending tasks of that type SHALL become eligible for processing

#### Scenario: Pause a task type
- **WHEN** the user clicks the pause control in an AI task card
- **THEN** the Options page SHALL send a per-type pause request through the Background relay to the app
- **AND** the app SHALL stop claiming additional pending tasks of that type
- **AND** tasks of that type already in processing SHALL be allowed to complete or fail normally
- **AND** tasks of the other AI type SHALL continue processing

#### Scenario: Show per-type scheduler state
- **WHEN** the Options page renders an AI task card
- **THEN** it SHALL display whether that task type is running or paused
- **AND** it SHALL display that task type's processing count and concurrency limit
- **AND** it SHALL display a progress bar showing completion percentage

#### Scenario: Persist per-type intent
- **WHEN** the user starts or pauses an AI task type
- **THEN** the app SHALL persist the new intent in configuration
- **AND** a restart SHALL restore that state for each task type
