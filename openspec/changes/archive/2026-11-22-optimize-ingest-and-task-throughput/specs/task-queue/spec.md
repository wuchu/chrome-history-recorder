## MODIFIED Requirements

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
