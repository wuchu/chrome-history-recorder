# Task Queue

## Purpose

Manage the AI classification task queue for media captured and stored in VFS, providing persistence, scheduling, and status reporting through the Extension/VFS workflow.

## Requirements

### Requirement: Queue persistence
The system SHALL persist classification queue state in the VFS Service storage layer so queue status can be resumed and reported after restart.

#### Scenario: Save queue through VFS
- **WHEN** the classification queue is modified
- **THEN** the system SHALL persist the queue state through VFS Service storage
- **AND** it SHALL NOT write standalone `.ai-classify-queue-tasks.json` files

#### Scenario: Load queue on startup
- **WHEN** the Extension Background or VFS Service starts
- **THEN** the system SHALL make the persisted VFS queue status available to Background and DevTools

#### Scenario: Empty queue on first run
- **WHEN** no persisted VFS queue entries exist
- **THEN** the system SHALL report an empty classification queue

### Requirement: Queue operations
The system SHALL support queue operations for media hashes captured and stored in VFS.

#### Scenario: Add to queue
- **WHEN** a new media file is captured and saved to VFS
- **THEN** the system SHALL add its hash to the pending classification queue

#### Scenario: Process next item
- **WHEN** the Background scheduler is running and capacity is available
- **THEN** the system SHALL claim pending VFS queue entries for processing

#### Scenario: Mark complete
- **WHEN** classification succeeds
- **THEN** the system SHALL mark the queue entry as completed and update AI-owned media metadata

#### Scenario: Mark failed
- **WHEN** classification fails
- **THEN** the system SHALL mark the queue entry as failed with an error message

### Requirement: Queue priority
The system SHALL support priority-based processing for VFS classification queue entries.

#### Scenario: Priority queue
- **WHEN** queue entries have different priorities
- **THEN** the Background scheduler SHALL process higher priority entries before lower priority entries when possible

#### Scenario: Default priority
- **WHEN** no priority is specified for a captured media item
- **THEN** the system SHALL use the default classification priority

### Requirement: Queue status
The system SHALL provide queue status information to the DevTools Panel through Background messages and queue events.

#### Scenario: Show queue status
- **WHEN** the DevTools Panel requests queue status
- **THEN** the system SHALL return counts of pending, processing, completed, and failed VFS queue entries
- **AND** it SHALL include scheduler running or paused state

#### Scenario: Refresh queue after actions
- **WHEN** the user starts, pauses, retries, clears, or requeues classification work
- **THEN** the DevTools Panel SHALL refresh queue status from Background

### Requirement: Queue recovery
The system SHALL tolerate missing or unavailable queue storage without exposing standalone CLI queue files.

#### Scenario: VFS unavailable
- **WHEN** the DevTools Panel requests queue status while VFS is unavailable
- **THEN** the system SHALL show an actionable unavailable state instead of reading a local CLI queue file

#### Scenario: VFS queue storage recovers
- **WHEN** VFS connection is restored
- **THEN** the system SHALL resume reporting queue status from VFS storage

### Requirement: Scheduler running state
The system SHALL track whether classification queue processing is running or paused and SHALL persist user start/pause intent in extension configuration.

#### Scenario: Start scheduler processing
- **WHEN** the scheduler is started by user action or startup configuration
- **THEN** the system SHALL mark scheduler state as running
- **AND** pending tasks SHALL be eligible for processing
- **AND** extension configuration SHALL record classification as not paused when the start is user initiated

#### Scenario: Pause scheduler processing
- **WHEN** the scheduler is paused by user action
- **THEN** the system SHALL mark scheduler state as paused
- **AND** the scheduler SHALL stop claiming new pending tasks
- **AND** active processing tasks SHALL be allowed to complete or fail
- **AND** extension configuration SHALL record classification as paused

#### Scenario: Report scheduler state
- **WHEN** queue status is requested
- **THEN** the system SHALL include scheduler running or paused state with queue counts

### Requirement: Default paused classification processing
The system SHALL default AI classification queue processing to paused for new/default extension configuration.

#### Scenario: Initialize with default paused state
- **WHEN** the extension initializes without a saved classification pause setting
- **THEN** the scheduler SHALL initialize in paused state
- **AND** it SHALL NOT claim pending classification tasks until explicitly started

#### Scenario: Respect saved running state
- **WHEN** the extension initializes with saved configuration indicating classification is not paused
- **THEN** the scheduler SHALL initialize in running state
- **AND** pending tasks SHALL be eligible for processing

#### Scenario: Respect saved paused state
- **WHEN** the extension initializes with saved configuration indicating classification is paused
- **THEN** the scheduler SHALL initialize in paused state
- **AND** pending tasks SHALL NOT be processed until the user starts classification

### Requirement: Paused scheduler queueing semantics
The system SHALL allow media to be queued while classification processing is paused, without consuming pending tasks.

#### Scenario: Capture media while paused
- **WHEN** media is captured while the scheduler is paused
- **THEN** the system SHALL be allowed to enqueue the media for classification
- **AND** the queued task SHALL remain pending until classification processing is started

#### Scenario: Manual requeue while paused
- **WHEN** the user requeues a media item while the scheduler is paused
- **THEN** the system SHALL add or reset the task as pending
- **AND** the scheduler SHALL NOT process the task until classification processing is started

#### Scenario: Start processing queued tasks
- **WHEN** the user starts classification after tasks have accumulated while paused
- **THEN** the scheduler SHALL begin processing pending tasks subject to concurrency and Ollama availability

### Requirement: User-triggered requeue
The system SHALL allow an existing media item to be requeued for AI classification and AI filename regeneration.

#### Scenario: Requeue existing completed item
- **WHEN** a completed media item is requeued by hash
- **THEN** the system SHALL reset or replace its queue entry as pending
- **AND** the task SHALL be processed according to scheduler state and priority

#### Scenario: Requeue failed item
- **WHEN** a failed media item is requeued by hash
- **THEN** the system SHALL clear the prior task error for the new attempt
- **AND** the task SHALL be eligible for processing as pending

#### Scenario: Requeue missing item
- **WHEN** a requeue request references a hash that does not exist in VFS
- **THEN** the system SHALL reject the request
- **AND** the queue SHALL NOT add a task for the missing hash

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

#### Scenario: Scheduler state changes
- **WHEN** the scheduler starts or pauses
- **THEN** the system SHALL emit a scheduler status event containing the new running or paused state
