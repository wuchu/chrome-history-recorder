## REMOVED Requirements

### Requirement: Service worker wake and recovery

**Reason**: The scheduler moves out of the MV3 service worker into the long-running app; there is no longer a suspendable worker to wake.
**Migration**: The app recovers `processing` tasks on its own startup, covered by `app-task-scheduler`'s stale recovery requirement.

## MODIFIED Requirements

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

### Requirement: Queue priority

The system SHALL support priority-based processing for VFS classification queue entries.

#### Scenario: Priority queue
- **WHEN** queue entries have different priorities
- **THEN** the app scheduler SHALL process higher priority entries before lower priority entries when possible

#### Scenario: Default priority
- **WHEN** no priority is specified for a captured media item
- **THEN** the system SHALL use the default classification priority

### Requirement: Queue status

The system SHALL provide queue status information that includes per-type counts and scheduler state.

#### Scenario: Show queue status
- **WHEN** the UI requests queue status
- **THEN** the system SHALL return pending, processing, completed, and failed counts
- **AND** it SHALL include a per-task-type breakdown
- **AND** it SHALL include engine running or paused state

#### Scenario: Refresh queue after actions
- **WHEN** the user starts, pauses, retries, clears, refreshes, or requeues work
- **THEN** the UI SHALL refresh queue status from the app

### Requirement: Scheduler running state

The system SHALL track whether task processing is running or paused and SHALL persist the user's start/pause intent in app configuration.

#### Scenario: Start processing
- **WHEN** the user starts processing
- **THEN** the system SHALL mark the scheduler as running
- **AND** pending tasks SHALL be eligible for processing
- **AND** app configuration SHALL record processing as active

#### Scenario: Pause processing
- **WHEN** the user pauses processing
- **THEN** the system SHALL mark the scheduler as paused
- **AND** the scheduler SHALL stop claiming new pending tasks
- **AND** active tasks SHALL be allowed to complete or fail
- **AND** app configuration SHALL record processing as paused

#### Scenario: Report engine state
- **WHEN** queue status is requested
- **THEN** the system SHALL include engine running or paused state with queue counts

### Requirement: Default paused classification processing

The system SHALL default AI classification queue processing to paused for new/default app configuration.

#### Scenario: Initialize with default paused state
- **WHEN** the app initializes without a saved classification pause setting
- **THEN** the scheduler SHALL initialize in paused state
- **AND** it SHALL NOT claim pending classification tasks until explicitly started

#### Scenario: Respect saved running state
- **WHEN** the app initializes with saved configuration indicating classification is not paused
- **THEN** the scheduler SHALL initialize in running state
- **AND** pending tasks SHALL be eligible for processing

#### Scenario: Respect saved paused state
- **WHEN** the app initializes with saved configuration indicating classification is paused
- **THEN** the scheduler SHALL initialize in paused state
- **AND** pending tasks SHALL NOT be processed until the user starts classification
