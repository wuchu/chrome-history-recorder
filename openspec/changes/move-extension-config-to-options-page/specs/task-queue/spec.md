## ADDED Requirements

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

## MODIFIED Requirements

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
