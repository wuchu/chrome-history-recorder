## MODIFIED Requirements

### Requirement: Per-task-type progress

The Options page SHALL display progress and scheduler state for each active AI task type.

#### Scenario: Show per-type progress
- **WHEN** the Options page renders AI task progress
- **THEN** it SHALL show progress for `classify` and `rename` separately
- **AND** each section SHALL show completed, skipped, and total counts for its type
- **AND** it SHALL show the failed count when it is greater than zero

#### Scenario: Show per-type scheduler state
- **WHEN** an AI task card renders
- **THEN** it SHALL show whether that task type is running or paused
- **AND** it SHALL show that task type's processing count and configured concurrency

#### Scenario: Hide idle task type
- **WHEN** a task type has no tasks
- **THEN** the Options page MAY hide that task type's progress section

### Requirement: Display task progress in an Options-native card

The Options page SHALL display AI task progress in a card layout using Ant Design components.

#### Scenario: Show progress bar with completion percentage
- **WHEN** the Options page renders task progress
- **THEN** it SHALL display a Progress component
- **AND** the progress bar SHALL show the completion percentage calculated from `(completed + skipped) / total` for that task type when total > 0
- **AND** the progress bar SHALL show `0%` when total = 0

#### Scenario: Progress bar color and animation based on task-type state
- **WHEN** a task type is running
- **THEN** its Progress component SHALL have `status="active"` and use a success color
- **WHEN** a task type is paused
- **THEN** its Progress component SHALL have `status="normal"` and SHALL NOT show animation
- **WHEN** there are failed tasks for that type
- **THEN** the Progress component SHALL have `status="exception"` and use an error color

#### Scenario: Skipped tasks do not signal failure
- **WHEN** a task type has skipped tasks but no failed tasks
- **THEN** the Progress component SHALL NOT use `status="exception"`
- **AND** the skipped count SHALL be visible in the card's summary text

#### Scenario: Show skip reason for a task
- **WHEN** the user inspects a skipped task in the task console
- **THEN** the interface SHALL expose the recorded skip reason

#### Scenario: Independent task-type progress
- **WHEN** one AI task type is paused and the other is running
- **THEN** each card SHALL reflect its own state
- **AND** pausing one type SHALL NOT change the other card's progress animation
