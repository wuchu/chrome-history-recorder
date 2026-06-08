## MODIFIED Requirements

### Requirement: Queue persistence
The system SHALL persist the task queue using an append-only event log to enable resumption after restart.

#### Scenario: Append event to log
- **WHEN** the queue is modified
- **THEN** the system SHALL append an event to the event log file

#### Scenario: Event log file location
- **WHEN** the system initializes
- **THEN** the queue state SHALL be persisted via the event log in the config file directory
- **AND** the log file SHALL be named `.ai-classify-events.log`

#### Scenario: Old file migration
- **WHEN** old `.ai-classify-queue-tasks.json` exists and new `.ai-classify-events.log` does not exist
- **THEN** the system SHALL NOT migrate (old format is deprecated)

#### Scenario: Load queue on startup
- **WHEN** the system starts
- **THEN** the system SHALL reconstruct queue state by replaying events from the log

#### Scenario: Empty queue on first run
- **WHEN** no event log exists
- **THEN** the system SHALL initialize an empty queue

### Requirement: Queue recovery
The system SHALL recover from crashes by replaying the event log.

#### Scenario: Replay events
- **WHEN** loading the queue on startup
- **THEN** the system SHALL replay all events after the last COMPACT
- **AND** the system SHALL reconstruct pending, processing, and failed state

#### Scenario: Handle zombie tasks
- **WHEN** tasks were in processing during crash
- **THEN** the system SHALL check index to determine completion status
- **AND** the system SHALL move interrupted tasks back to pending

#### Scenario: Handle corrupted log
- **WHEN** event log has corrupted lines
- **THEN** the system SHALL skip corrupted lines
- **AND** the system SHALL log a warning

## REMOVED Requirements

### Requirement: Queue file JSON format
**Reason**: Replaced by append-only event log format
**Migration**: Old `.ai-classify-queue-tasks.json` files are no longer used. The system will start with empty queue if event log doesn't exist.