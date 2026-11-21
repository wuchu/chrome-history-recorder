## REMOVED Requirements

### Requirement: DevTools exposes classification scheduler controls

**Reason**: Replaced by independent controls for `classify` and `rename`; a single classification start/pause control no longer represents the scheduler.

**Migration**: The Options page now sends `setTaskPaused` with a task type. Existing `startClassification` / `pauseClassification` requests are treated as applying to both AI task types for version compatibility.

## MODIFIED Requirements

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

## ADDED Requirements

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
