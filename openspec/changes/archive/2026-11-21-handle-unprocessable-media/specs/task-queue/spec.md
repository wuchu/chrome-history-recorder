## ADDED Requirements

### Requirement: Skipped task status

The system SHALL support `skipped` as a terminal task status meaning "this media is not applicable to the AI pipeline". A skipped task SHALL record a human-readable reason, SHALL NOT be claimable, SHALL NOT be retried automatically, and SHALL persist across restarts.

#### Scenario: Record a skipped task for new media
- **WHEN** an ineligible media hash is recorded for a task type that has no existing row
- **THEN** the system SHALL create the row with status `skipped` and the eligibility reason
- **AND** it SHALL NOT create the row as `pending`

#### Scenario: Convert an existing pending or failed task
- **WHEN** a pending or failed task is determined to reference ineligible media
- **THEN** the system SHALL set its status to `skipped` and record the reason
- **AND** it SHALL clear `next_run_at` and `started_at`
- **AND** it SHALL leave `attempts` unchanged because no retry occurred

#### Scenario: Preserve completed results
- **WHEN** a completed task exists for media that is currently ineligible
- **THEN** the system SHALL leave the completed task unchanged

#### Scenario: Skipped tasks are not claimable
- **WHEN** the engine claims pending tasks
- **THEN** tasks with status `skipped` SHALL NOT be returned
- **AND** they SHALL NOT consume a concurrency slot

#### Scenario: Skipped status survives restart
- **WHEN** the app restarts
- **THEN** skipped tasks SHALL remain skipped
- **AND** stale-task recovery SHALL NOT reset them to pending

## MODIFIED Requirements

### Requirement: Queue status

The system SHALL provide queue status information that includes per-type counts and scheduler state.

#### Scenario: Show queue status
- **WHEN** the UI requests queue status
- **THEN** the system SHALL return pending, processing, completed, failed, and skipped counts
- **AND** it SHALL include a per-task-type breakdown
- **AND** it SHALL include engine running or paused state
- **AND** `total` SHALL include skipped rows

#### Scenario: Refresh queue after actions
- **WHEN** the user starts, pauses, retries, clears, refreshes, or requeues work
- **THEN** the UI SHALL refresh queue status from the app

### Requirement: User-triggered requeue
The system SHALL allow an existing media item to be requeued per task type.

#### Scenario: Requeue completed item for one type
- **WHEN** a completed task is requeued by hash and task type
- **THEN** the system SHALL reset that task to `pending`
- **AND** it SHALL NOT change tasks of other types for the same hash

#### Scenario: Requeue failed item
- **WHEN** a failed task is requeued
- **THEN** the system SHALL clear the prior error and reset attempts for the new attempt

#### Scenario: Requeue ineligible media
- **WHEN** a requeue request targets media that is ineligible for AI vision processing
- **THEN** the system SHALL record the task as `skipped` with the eligibility reason
- **AND** it SHALL NOT reset the task to `pending`
- **AND** it SHALL return the reason to the caller

#### Scenario: Requeue missing item
- **WHEN** a requeue request references a hash that does not exist in VFS
- **THEN** the system SHALL reject the request
- **AND** the queue SHALL NOT add a task for the missing hash

### Requirement: Full rescan refresh
The system SHALL provide a full rescan that requeues all eligible media for one or more task types.

#### Scenario: Full rescan for a task type
- **WHEN** the user triggers a full rescan for `classify`
- **THEN** the system SHALL create or reset `classify` tasks as `pending` for eligible media
- **AND** completed tasks for eligible media SHALL be reset so they are processed again

#### Scenario: Full rescan preserves ineligible outcomes
- **WHEN** a full rescan includes ineligible media
- **THEN** those tasks SHALL become or remain `skipped` with the eligibility reason
- **AND** the system SHALL NOT reset them to `pending`

#### Scenario: Full rescan respects concurrency
- **WHEN** a full rescan enqueues many tasks
- **THEN** the engine SHALL process them subject to the global concurrency limit

### Requirement: Queue status events
The system SHALL publish queue and task status changes to connected extension clients.

#### Scenario: Task starts processing
- **WHEN** a task changes from pending to processing
- **THEN** the system SHALL emit a task status event containing the hash and processing status

#### Scenario: Task completes
- **WHEN** a task completes successfully
- **THEN** the system SHALL emit a task status event containing the hash and completed status

#### Scenario: Task fails
- **WHEN** a task fails
- **THEN** the system SHALL emit a task status event containing the hash, failed status, and error message

#### Scenario: Task is skipped
- **WHEN** a task is marked `skipped`
- **THEN** the system SHALL emit a task status event containing the hash, skipped status, task type, and reason

#### Scenario: Scheduler state changes
- **WHEN** the scheduler starts or pauses
- **THEN** the system SHALL emit a scheduler status event containing the new running or paused state
