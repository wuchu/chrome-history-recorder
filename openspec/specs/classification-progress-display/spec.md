# Classification Progress Display

## Purpose

Define a compact, single-line progress display for AI tasks (classification and rename) that sits above the tag tab bar, using Ant Design components.

## Requirements

### Requirement: Per-task-type progress
The Side Panel SHALL display progress for each active AI task type.

#### Scenario: Show per-type progress
- **WHEN** the Side Panel renders AI task progress
- **THEN** it SHALL show progress for `classify` and `rename` separately
- **AND** each section SHALL show completed and total counts for its type

#### Scenario: Hide idle task type
- **WHEN** a task type has no tasks
- **THEN** the Side Panel MAY hide that task type's progress section

### Requirement: Task refresh controls
The Side Panel SHALL provide manual refresh controls for AI tasks.

#### Scenario: Refresh a single file
- **WHEN** the user triggers refresh on a media item
- **THEN** the Side Panel SHALL requeue the selected task type for that hash

#### Scenario: Full rescan
- **WHEN** the user triggers a full rescan
- **THEN** the Side Panel SHALL requeue all media for the selected task type or types
- **AND** it SHALL ask for confirmation before starting the full rescan

### Requirement: Display classification progress in compact single-line layout
The Side Panel SHALL display AI task progress in a compact layout positioned above the tag tab bar.

#### Scenario: Show progress bar with completion percentage
- **WHEN** the Side Panel renders task progress
- **THEN** it SHALL display a Progress component with `size="small"`
- **AND** the progress bar SHALL show the completion percentage calculated from completed and total counts for that task type when total > 0
- **AND** the progress bar SHALL show `0%` when total = 0

#### Scenario: Progress bar color and animation based on engine state
- **WHEN** the task engine is running
- **THEN** the Progress component SHALL have `status="active"` and use a success color
- **WHEN** the task engine is paused
- **THEN** the Progress component SHALL have `status="normal"` and SHALL NOT show animation
- **WHEN** there are failed tasks for that type
- **THEN** the Progress component SHALL have `status="exception"` and use an error color

### Requirement: Use small icon buttons with tooltips
The Side Panel SHALL provide task controls using small icon buttons with tooltips.

#### Scenario: Display start/pause button
- **WHEN** the engine is paused
- **THEN** the Side Panel SHALL display a start icon button with a tooltip
- **WHEN** the engine is running
- **THEN** the Side Panel SHALL display a pause icon button with a tooltip

#### Scenario: Display retry failed button
- **WHEN** there are failed tasks
- **THEN** the Side Panel SHALL display a retry icon button with a tooltip

#### Scenario: Display refresh button
- **WHEN** tasks exist
- **THEN** the Side Panel SHALL display a refresh control that offers single-file requeue where applicable and full rescan

#### Scenario: Display clear queue button
- **WHEN** there are any tasks in the queue
- **THEN** the Side Panel SHALL display a clear-queue icon button with a tooltip
- **AND** clicking it SHALL show a confirmation dialog before clearing

### Requirement: Show AI classification label
The progress display SHALL include a visual indicator that this section relates to AI classification.

#### Scenario: Show AI classification icon/label
- **WHEN** the progress display is rendered
- **THEN** it SHALL display a RobotOutlined icon or "🤖 AI 分类" label at the beginning of the line
