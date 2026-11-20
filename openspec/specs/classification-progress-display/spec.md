# Classification Progress Display

## Purpose

Define the per-type AI task progress display (classification and rename) for the Options page, using Ant Design components.

## Requirements

### Requirement: Per-task-type progress
The Options page SHALL display progress for each active AI task type.

#### Scenario: Show per-type progress
- **WHEN** the Options page renders AI task progress
- **THEN** it SHALL show progress for `classify` and `rename` separately
- **AND** each section SHALL show completed and total counts for its type

#### Scenario: Hide idle task type
- **WHEN** a task type has no tasks
- **THEN** the Options page MAY hide that task type's progress section

### Requirement: Task refresh controls
The Options page SHALL provide a full rescan refresh control for AI tasks; single-file refresh remains available from the Side Panel media detail and grid quick actions.

#### Scenario: Refresh a single file
- **WHEN** the user triggers refresh on a media item
- **THEN** the Side Panel SHALL requeue the selected task type for that hash

#### Scenario: Full rescan
- **WHEN** the user triggers a full rescan from the Options page
- **THEN** the Options page SHALL requeue all media for the selected task type or types
- **AND** it SHALL ask for confirmation before starting the full rescan

### Requirement: Display task progress in an Options-native card
The Options page SHALL display AI task progress in a card layout using Ant Design components.

#### Scenario: Show progress bar with completion percentage
- **WHEN** the Options page renders task progress
- **THEN** it SHALL display a Progress component
- **AND** the progress bar SHALL show the completion percentage calculated from completed and total counts for that task type when total > 0
- **AND** the progress bar SHALL show `0%` when total = 0

#### Scenario: Progress bar color and animation based on engine state
- **WHEN** the task engine is running
- **THEN** the Progress component SHALL have `status="active"` and use a success color
- **WHEN** the task engine is paused
- **THEN** the Progress component SHALL have `status="normal"` and SHALL NOT show animation
- **WHEN** there are failed tasks for that type
- **THEN** the Progress component SHALL have `status="exception"` and use an error color
