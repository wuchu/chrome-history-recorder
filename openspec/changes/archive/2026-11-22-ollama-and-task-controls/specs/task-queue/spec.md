## REMOVED Requirements

### Requirement: Global concurrency limit across task types

**Reason**: Replaced by independent per-task-type concurrency limits and pause state; a single global limit cannot express independent `classify` and `rename` controls.

**Migration**: Legacy `classificationConcurrency` is migrated to `ollamaMaxConcurrency`, which caps actual `/api/chat` requests. Per-task concurrency fields are added with a default of `1`.

## MODIFIED Requirements

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

## ADDED Requirements

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
