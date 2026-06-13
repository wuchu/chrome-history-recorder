## ADDED Requirements

### Requirement: Scheduler running state
The system SHALL track whether classification queue processing is running or paused.

#### Scenario: Start scheduler processing
- **WHEN** the scheduler is started by user action or startup configuration
- **THEN** the system SHALL mark scheduler state as running
- **AND** pending tasks SHALL be eligible for processing

#### Scenario: Pause scheduler processing
- **WHEN** the scheduler is paused by user action
- **THEN** the system SHALL mark scheduler state as paused
- **AND** the scheduler SHALL stop claiming new pending tasks
- **AND** active processing tasks SHALL be allowed to complete or fail

#### Scenario: Report scheduler state
- **WHEN** queue status is requested
- **THEN** the system SHALL include scheduler running or paused state with queue counts

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
