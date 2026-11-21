## ADDED Requirements

### Requirement: Trash-aware task claiming

The task queue SHALL suspend tasks whose target file is in the trash instead of cancelling or deleting them.

#### Scenario: Pending task for a trashed file is not claimed
- **WHEN** the engine claims pending tasks and a task's target file has `is_deleted = 1`
- **THEN** the task SHALL remain `pending`
- **AND** it SHALL NOT consume a concurrency slot
- **AND** it SHALL NOT be counted in queue status as active pending work

#### Scenario: Restore makes tasks claimable again
- **WHEN** a file is restored from the trash
- **THEN** its existing pending or retrying tasks SHALL become claimable again
- **AND** no task row needs to be recreated

#### Scenario: Permanent delete removes tasks
- **WHEN** a trashed file is permanently deleted
- **THEN** all tasks for that hash SHALL be deleted
- **AND** they SHALL no longer appear in queue status

#### Scenario: In-flight task at trash time
- **WHEN** a file is moved to the trash while a task for it is already `processing`
- **THEN** the task SHALL be allowed to complete or fail normally
- **AND** a failure SHALL follow the normal backoff path and remain suspended until restore

#### Scenario: Trashed tasks survive restart
- **WHEN** the app restarts with pending tasks for trashed files
- **THEN** those tasks SHALL remain persisted and suspended
- **AND** stale-task recovery SHALL NOT process them while the target is trashed
