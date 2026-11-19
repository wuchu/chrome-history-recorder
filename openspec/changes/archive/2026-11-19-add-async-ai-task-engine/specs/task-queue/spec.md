## ADDED Requirements

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

### Requirement: Global concurrency limit across task types
The system SHALL apply a single global concurrency limit to all task types so that local AI model load is bounded regardless of how many task types are queued.

#### Scenario: Concurrency shared between types
- **WHEN** the global concurrency limit is N and N tasks of any type are processing
- **THEN** the engine SHALL NOT claim additional tasks of any type until a slot frees

#### Scenario: Adjust concurrency
- **WHEN** the user changes the concurrency setting
- **THEN** the engine SHALL apply the new limit to subsequent claims without restarting the queue

### Requirement: Service worker wake and recovery
The system SHALL resume pending task processing after the Extension Service Worker is suspended or the browser restarts.

#### Scenario: Resume after browser restart
- **WHEN** the browser starts and the persisted run intent indicates processing is active
- **THEN** the system SHALL initialize the engine and continue claiming pending tasks

#### Scenario: Recover stale processing tasks
- **WHEN** the Extension Service Worker starts
- **THEN** the system SHALL reset tasks left in `processing` by a previous worker to `pending`
- **AND** those tasks SHALL become eligible for processing again

#### Scenario: Wake after idle suspension
- **WHEN** a periodic wake alarm fires while the engine should be running
- **THEN** the system SHALL ensure initialization has occurred and attempt to claim pending tasks

#### Scenario: Resume on VFS reconnect
- **WHEN** the VFS connection is restored while the run intent indicates processing is active
- **THEN** the system SHALL resume claiming pending tasks

### Requirement: Full rescan refresh
The system SHALL provide a full rescan that requeues all media for one or more task types.

#### Scenario: Full rescan for a task type
- **WHEN** the user triggers a full rescan for `classify`
- **THEN** the system SHALL create or reset `classify` tasks as `pending` for all eligible media
- **AND** completed tasks SHALL be reset so they are processed again

#### Scenario: Full rescan respects concurrency
- **WHEN** a full rescan enqueues many tasks
- **THEN** the engine SHALL process them subject to the global concurrency limit

## MODIFIED Requirements

### Requirement: Queue persistence
The system SHALL persist typed task state in the VFS Service storage layer so task status can be resumed and reported after Service Worker or browser restart.

#### Scenario: Persist tasks through VFS
- **WHEN** a task is enqueued or changes status
- **THEN** the system SHALL persist the task state through VFS Service storage
- **AND** it SHALL NOT write standalone queue files in the extension

#### Scenario: Load tasks on startup
- **WHEN** the Extension Background or VFS Service starts
- **THEN** the system SHALL make the persisted typed task status available to Background and UI

#### Scenario: Empty queue on first run
- **WHEN** no persisted task entries exist
- **THEN** the system SHALL report an empty queue

### Requirement: Queue operations
The system SHALL support typed task operations for media hashes captured and stored in VFS.

#### Scenario: Add to queue
- **WHEN** a new media file is captured and saved to VFS
- **THEN** the system SHALL add its hash to the pending task queue for each configured task type

#### Scenario: Claim next task
- **WHEN** the engine is running and a concurrency slot is free
- **THEN** the system SHALL atomically claim a pending task of any type for processing
- **AND** a claimed task SHALL move from `pending` to `processing`

#### Scenario: Mark complete
- **WHEN** a task succeeds
- **THEN** the system SHALL mark the task completed and update the task-type-owned metadata

#### Scenario: Mark failed
- **WHEN** a task fails
- **THEN** the system SHALL increment its attempt count, record the error, and either schedule a retry or mark it failed according to `max_attempts`

### Requirement: Queue status
The system SHALL provide queue status information that includes per-type counts and scheduler state.

#### Scenario: Show queue status
- **WHEN** the UI requests queue status
- **THEN** the system SHALL return pending, processing, completed, and failed counts
- **AND** it SHALL include a per-task-type breakdown
- **AND** it SHALL include engine running or paused state

#### Scenario: Refresh queue after actions
- **WHEN** the user starts, pauses, retries, clears, refreshes, or requeues work
- **THEN** the UI SHALL refresh queue status from Background

### Requirement: Queue recovery
The system SHALL tolerate missing or unavailable queue storage without exposing standalone queue files.

#### Scenario: VFS unavailable
- **WHEN** the UI requests queue status while VFS is unavailable
- **THEN** the system SHALL show an actionable unavailable state instead of reading a local queue file

#### Scenario: VFS queue storage recovers
- **WHEN** the VFS connection is restored
- **THEN** the system SHALL resume reporting queue status from VFS storage and resume processing

### Requirement: Scheduler running state
The system SHALL track whether task processing is running or paused and SHALL persist the user's start/pause intent in extension configuration.

#### Scenario: Start processing
- **WHEN** the user starts processing
- **THEN** the system SHALL mark the engine as running
- **AND** pending tasks SHALL be eligible for processing
- **AND** extension configuration SHALL record processing as active

#### Scenario: Pause processing
- **WHEN** the user pauses processing
- **THEN** the system SHALL mark the engine as paused
- **AND** the engine SHALL stop claiming new pending tasks
- **AND** active tasks SHALL be allowed to complete or fail
- **AND** extension configuration SHALL record processing as paused

#### Scenario: Report engine state
- **WHEN** queue status is requested
- **THEN** the system SHALL include engine running or paused state with queue counts

### Requirement: User-triggered requeue
The system SHALL allow an existing media item to be requeued per task type.

#### Scenario: Requeue completed item for one type
- **WHEN** a completed task is requeued by hash and task type
- **THEN** the system SHALL reset that task to `pending`
- **AND** it SHALL NOT change tasks of other types for the same hash

#### Scenario: Requeue failed item
- **WHEN** a failed task is requeued
- **THEN** the system SHALL clear the prior error and reset attempts for the new attempt

#### Scenario: Requeue missing item
- **WHEN** a requeue request references a hash that does not exist in VFS
- **THEN** the system SHALL reject the request
- **AND** the queue SHALL NOT add a task for the missing hash
