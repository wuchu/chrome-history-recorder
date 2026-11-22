# Task Queue

## Purpose

Manage typed AI task queues (classification and rename) for media captured and stored in VFS, providing persistence, app-owned scheduling, and status reporting.
## Requirements
### Requirement: Multi-type task model
The system SHALL model AI work as typed tasks that share one queue, where each task has a `task_type` and a `target_hash`, and at most one task exists per `(task_type, target_hash)` pair.

#### Scenario: Enqueue typed tasks for one file
- **WHEN** a new media file is captured
- **THEN** the system SHALL be able to enqueue a `classify` task and a `rename` task for the same hash
- **AND** the two tasks SHALL have independent status, attempts, and errors

#### Scenario: Idempotent automatic enqueue
- **WHEN** an automatic enqueue targets a `(task_type, target_hash)` pair that already has a task
- **THEN** the system SHALL NOT create a duplicate task
- **AND** it SHALL NOT reset an existing completed task

#### Scenario: Unknown task type
- **WHEN** the engine claims a task whose `task_type` has no registered handler
- **THEN** the system SHALL mark the task failed with an actionable error message
- **AND** it SHALL continue processing other tasks

### Requirement: Queue persistence

The system SHALL persist typed task state in the VFS Service storage layer so task status can be resumed and reported after app or browser restart.

#### Scenario: Persist tasks through VFS
- **WHEN** a task is enqueued or changes status
- **THEN** the system SHALL persist the task state through VFS Service storage
- **AND** it SHALL NOT write standalone queue files in the extension

#### Scenario: Load tasks on startup
- **WHEN** the app starts
- **THEN** the system SHALL make the persisted typed task status available to the scheduler and UI

#### Scenario: Empty queue on first run
- **WHEN** no persisted task entries exist
- **THEN** the system SHALL report an empty queue

### Requirement: Queue operations
The system SHALL support typed task operations for media hashes captured and stored in VFS.
The engine SHALL claim tasks according to the pause state and concurrency limit of each task type.

#### Scenario: Add to queue
- **WHEN** a new media file is captured and saved to VFS
- **THEN** the system SHALL add its hash to the pending task queue for each configured task type

#### Scenario: Claim next task
- **WHEN** a task type is not paused and a slot for that task type is free
- **THEN** the system SHALL atomically claim a pending task of that type for processing
- **AND** a claimed task SHALL move from `pending` to `processing`

#### Scenario: Mark complete
- **WHEN** a task succeeds
- **THEN** the system SHALL mark the task completed and update the task-type-owned metadata

#### Scenario: Mark failed
- **WHEN** a task fails
- **THEN** the system SHALL increment its attempt count, record the error, and either schedule a retry or mark it failed according to `max_attempts`

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

### Requirement: Queue priority

The system SHALL support priority-based processing for VFS classification queue entries.

#### Scenario: Priority queue
- **WHEN** queue entries have different priorities
- **THEN** the app scheduler SHALL process higher priority entries before lower priority entries when possible

#### Scenario: Default priority
- **WHEN** no priority is specified for a captured media item
- **THEN** the system SHALL use the default classification priority

### Requirement: Queue status

The system SHALL provide queue status information that includes per-type counts and per-type scheduler state.

#### Scenario: Show queue status
- **WHEN** the UI requests queue status
- **THEN** the system SHALL return pending, processing, completed, failed, and skipped counts
- **AND** it SHALL include a per-task-type breakdown
- **AND** it SHALL include the running or paused state, processing count, and concurrency limit for each task type
- **AND** `total` SHALL include skipped rows

#### Scenario: Refresh queue after actions
- **WHEN** the user starts, pauses, retries, clears, refreshes, or requeues work
- **THEN** the UI SHALL refresh queue status from the app

### Requirement: Queue recovery
The system SHALL tolerate missing or unavailable queue storage without exposing standalone queue files.

#### Scenario: VFS unavailable
- **WHEN** the UI requests queue status while VFS is unavailable
- **THEN** the system SHALL show an actionable unavailable state instead of reading a local queue file

#### Scenario: VFS queue storage recovers
- **WHEN** the VFS connection is restored
- **THEN** the system SHALL resume reporting queue status from VFS storage and resume processing

### Requirement: Scheduler running state

The system SHALL track whether each task type is running or paused and SHALL persist the user's start/pause intent per task type in app configuration.

#### Scenario: Start processing
- **WHEN** the user starts a task type
- **THEN** the system SHALL mark that task type as running
- **AND** pending tasks of that type SHALL be eligible for processing
- **AND** app configuration SHALL record that task type as active

#### Scenario: Pause processing
- **WHEN** the user pauses a task type
- **THEN** the system SHALL mark that task type as paused
- **AND** the engine SHALL stop claiming new pending tasks of that type
- **AND** active tasks of that type SHALL be allowed to complete or fail
- **AND** app configuration SHALL record that task type as paused

#### Scenario: Independent task-type state
- **WHEN** one task type is paused and another is running
- **THEN** the paused type SHALL NOT claim tasks
- **AND** the running type SHALL continue claiming tasks

#### Scenario: Report engine state
- **WHEN** queue status is requested
- **THEN** the system SHALL include the running or paused state for each task type with queue counts

### Requirement: Default paused classification processing

The system SHALL default both AI task types to paused for new/default app configuration.

#### Scenario: Initialize with default paused state
- **WHEN** the app initializes without saved per-type pause settings
- **THEN** the scheduler SHALL initialize `classify` and `rename` as paused
- **AND** it SHALL NOT claim pending tasks of either type until explicitly started

#### Scenario: Respect saved running state
- **WHEN** the app initializes with saved configuration indicating a task type is not paused
- **THEN** the scheduler SHALL initialize that task type as running
- **AND** pending tasks of that type SHALL be eligible for processing

#### Scenario: Respect saved paused state
- **WHEN** the app initializes with saved configuration indicating a task type is paused
- **THEN** the scheduler SHALL initialize that task type as paused
- **AND** pending tasks of that type SHALL NOT be processed until the user starts it

#### Scenario: Mixed saved state
- **WHEN** the app initializes with one AI task type running and the other paused
- **THEN** the scheduler SHALL claim tasks only for the running type

### Requirement: Paused scheduler queueing semantics

The system SHALL allow media to be queued while a task type is paused, without consuming pending tasks of that type.

#### Scenario: Capture media while paused
- **WHEN** media is captured while one or both AI task types are paused
- **THEN** the system SHALL be allowed to enqueue the media for those task types
- **AND** the queued tasks SHALL remain pending until the corresponding task type is started

#### Scenario: Manual requeue while paused
- **WHEN** the user requeues a media item while its task type is paused
- **THEN** the system SHALL add or reset the task as pending
- **AND** the scheduler SHALL NOT process the task until that task type is started

#### Scenario: Start processing queued tasks
- **WHEN** the user starts a task type after tasks have accumulated while paused
- **THEN** the scheduler SHALL begin processing pending tasks of that type subject to its concurrency limit and Ollama availability

#### Scenario: Pause one type does not block the other
- **WHEN** `classify` is paused and `rename` is running
- **THEN** pending `rename` tasks SHALL continue to be processed
- **AND** pending `classify` tasks SHALL remain pending

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
- **THEN** the engine SHALL process them subject to each task type's concurrency limit

### Requirement: Queue status events
The system SHALL publish task lifecycle changes individually and MAY coalesce snapshot-style queue status changes while always exposing the latest counts.

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
- **WHEN** the scheduler starts or pauses, or a task type's concurrency changes
- **THEN** the system SHALL emit a scheduler status event containing the new state without waiting for a coalescing window

#### Scenario: Queue snapshots are coalesced
- **WHEN** multiple tasks change status within the coalescing window
- **THEN** the system SHALL emit at most one `queue:updated` snapshot per window
- **AND** the snapshot SHALL include the latest per-type counts and scheduler state
- **AND** each task transition SHALL still produce its own lifecycle event

#### Scenario: Processing counts use the latest snapshot
- **WHEN** the scheduler begins or ends processing a task
- **THEN** it SHALL NOT emit a standalone scheduler status event solely to publish the processing count
- **AND** the latest processing count SHALL be available in the next `queue:updated` snapshot

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

### Requirement: Per-task-type concurrency limits

The engine SHALL apply an independent concurrency limit to each AI task type.

#### Scenario: Concurrency applies within a type
- **WHEN** a task type's concurrency limit is `N` and `N` tasks of that type are processing
- **THEN** the engine SHALL NOT claim additional tasks of that type until a slot frees

#### Scenario: Concurrency does not apply across types
- **WHEN** all slots of one task type are busy
- **THEN** the engine MAY still claim tasks of another type while its own slots are free

#### Scenario: Adjust concurrency
- **WHEN** the user changes a task type's concurrency setting
- **THEN** the engine SHALL apply the new limit to subsequent claims of that type without restarting the queue

#### Scenario: Skipped task releases a slot
- **WHEN** a task becomes `skipped`
- **THEN** it SHALL release its task-type slot
- **AND** it SHALL NOT count against the concurrency limit
