## ADDED Requirements

### Requirement: DevTools exposes classification scheduler controls
The extension SHALL allow users to start and pause AI classification processing from the DevTools Panel.

#### Scenario: Start classification processing
- **WHEN** the user clicks the classification start control
- **THEN** the DevTools Panel SHALL send a start request to the Background Service Worker
- **AND** the Background Service Worker SHALL set the classification scheduler to running
- **AND** pending classification tasks SHALL become eligible for processing

#### Scenario: Pause classification processing
- **WHEN** the user clicks the classification pause control
- **THEN** the DevTools Panel SHALL send a pause request to the Background Service Worker
- **AND** the Background Service Worker SHALL stop the scheduler from claiming additional pending tasks
- **AND** tasks already in processing SHALL be allowed to complete or fail normally

#### Scenario: Show scheduler control state
- **WHEN** the DevTools Panel renders classification progress
- **THEN** it SHALL display whether classification processing is running or paused
- **AND** it SHALL display the next valid action for the current state

### Requirement: DevTools exposes queue maintenance actions
The extension SHALL expose queue maintenance actions for failed and queued classification work.

#### Scenario: Retry failed tasks
- **WHEN** the user clicks retry failed tasks
- **THEN** the DevTools Panel SHALL request Background to retry failed queue entries
- **AND** Background SHALL reset failed tasks to pending through VFS
- **AND** queue status SHALL refresh after the operation

#### Scenario: Clear classification queue
- **WHEN** the user clicks clear queue and confirms the action
- **THEN** the DevTools Panel SHALL request Background to clear the classification queue through VFS
- **AND** queue status SHALL refresh after the operation

### Requirement: DevTools exposes Ollama model selection
The extension SHALL allow users to discover and select installed Ollama models from the DevTools configuration UI.

#### Scenario: Load available models
- **WHEN** the user opens the AI configuration area or clicks refresh models
- **THEN** the DevTools Panel SHALL request the model list from Background
- **AND** Background SHALL query the configured Ollama endpoint for installed models
- **AND** the DevTools Panel SHALL display returned model names as selectable options

#### Scenario: Save selected model
- **WHEN** the user selects an Ollama model
- **THEN** the DevTools Panel SHALL update extension configuration with the selected model
- **AND** future classification tasks SHALL use that model

#### Scenario: Handle model discovery failure
- **WHEN** the configured Ollama endpoint is unavailable or returns an invalid model list
- **THEN** the DevTools Panel SHALL keep the current configured model value
- **AND** it SHALL show an actionable error or unavailable status

### Requirement: Media quick actions requeue AI processing
The extension SHALL provide quick actions that requeue a specific media item for classification and AI filename regeneration.

#### Scenario: Requeue media from detail view
- **WHEN** the user clicks reclassify or regenerate AI filename for a media item
- **THEN** the DevTools Panel SHALL send that media hash to Background for requeue
- **AND** Background SHALL enqueue the hash for classification with elevated priority
- **AND** the media item SHALL show a pending or queued status after the operation

#### Scenario: Requeue media from grid quick action
- **WHEN** the user invokes a requeue quick action from a media card
- **THEN** the same requeue behavior SHALL apply as the detail view action

#### Scenario: Preserve user-owned metadata during reprocessing
- **WHEN** requeued AI processing completes
- **THEN** the system SHALL overwrite AI-owned fields such as category, ai_filename, tags, confidence, classified_at, and model_used
- **AND** it SHALL preserve user-owned fields such as is_starred and user_notes

### Requirement: Rename means AI filename metadata generation
The extension SHALL define rename controls in this workflow as AI filename metadata generation, not physical file renaming.

#### Scenario: Generate AI filename without physical rename
- **WHEN** a classify and rename task completes
- **THEN** the system SHALL update the media item's ai_filename metadata
- **AND** it SHALL NOT rename, move, export, or delete the underlying hash-addressed blob file
