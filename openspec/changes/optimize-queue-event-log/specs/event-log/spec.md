## ADDED Requirements

### Requirement: Event log persistence
The system SHALL persist task state changes using an append-only event log.

#### Scenario: Append event to log
- **WHEN** a task state changes (enqueue, start, complete, fail)
- **THEN** the system SHALL append an event to the log file

#### Scenario: Event log file location
- **WHEN** the system initializes
- **THEN** the event log SHALL be stored in the config file directory
- **AND** the log file SHALL be named `.ai-classify-events.log`

#### Scenario: Event log format
- **WHEN** writing an event
- **THEN** each event SHALL be a single JSON line
- **AND** each event SHALL include `type`, `ts` (timestamp), and relevant data

### Requirement: Event types
The system SHALL support the following event types.

#### Scenario: ENQUEUE event
- **WHEN** a new task is added to the queue
- **THEN** the system SHALL write an ENQUEUE event with full task details

#### Scenario: START event
- **WHEN** a task begins processing
- **THEN** the system SHALL write a START event with full task details

#### Scenario: COMPLETE event
- **WHEN** a task completes successfully
- **THEN** the system SHALL write a COMPLETE event with path, hash, output, and category

#### Scenario: FAIL event
- **WHEN** a task fails
- **THEN** the system SHALL write a FAIL event with path and error message

#### Scenario: RETRY event
- **WHEN** a failed task is retried
- **THEN** the system SHALL write a RETRY event with task details

#### Scenario: COMPACT event
- **WHEN** the log is compacted
- **THEN** the system SHALL write a COMPACT event with full state snapshot

### Requirement: State recovery from event log
The system SHALL recover complete state by replaying the event log.

#### Scenario: Load state on startup
- **WHEN** the system starts
- **THEN** the system SHALL read and replay all events from the log
- **AND** the system SHALL reconstruct pending, processing, failed, and index state

#### Scenario: Start from COMPACT snapshot
- **WHEN** a COMPACT event exists in the log
- **THEN** the system SHALL initialize state from the COMPACT snapshot
- **AND** the system SHALL replay events after the COMPACT

#### Scenario: Empty log on first run
- **WHEN** no event log exists
- **THEN** the system SHALL initialize empty state

### Requirement: Zombie task handling
The system SHALL handle tasks that were processing during a crash.

#### Scenario: Check index for zombie task
- **WHEN** recovering state and a task was in processing
- **THEN** the system SHALL check if the task's hash exists in the index

#### Scenario: Zombie task completed
- **WHEN** a zombie task's hash exists in the index
- **THEN** the system SHALL mark the task as completed
- **AND** the system SHALL remove it from processing

#### Scenario: Zombie task interrupted
- **WHEN** a zombie task's hash does not exist in the index
- **THEN** the system SHALL check for residual output files
- **AND** the system SHALL delete any residual files
- **AND** the system SHALL move the task back to pending

### Requirement: Log compact
The system SHALL periodically compact the event log.

#### Scenario: Compact threshold by lines
- **WHEN** the log has more than 500 lines
- **THEN** the system SHALL trigger a compact operation

#### Scenario: Compact threshold by size
- **WHEN** the log file size exceeds 100KB
- **THEN** the system SHALL trigger a compact operation

#### Scenario: Compact on normal exit
- **WHEN** the system stops normally
- **THEN** the system SHALL compact the log

#### Scenario: Compact operation
- **WHEN** compacting the log
- **THEN** the system SHALL write a COMPACT event with full state snapshot
- **AND** the system SHALL truncate old events

### Requirement: Concurrent write protection
The system SHALL protect against concurrent writes to the event log.

#### Scenario: Sequential writes
- **WHEN** multiple events are written concurrently
- **THEN** the system SHALL serialize writes using a write lock
- **AND** each write SHALL complete before the next begins

### Requirement: Corrupted log handling
The system SHALL handle corrupted event log gracefully.

#### Scenario: Skip corrupted lines
- **WHEN** the log file has corrupted lines
- **THEN** the system SHALL skip corrupted lines during replay
- **AND** the system SHALL log a warning

#### Scenario: Empty state on total corruption
- **WHEN** the log file is completely unreadable
- **THEN** the system SHALL return empty state
- **AND** the system SHALL log a warning