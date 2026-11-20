## ADDED Requirements

### Requirement: Live queue updates
The Options page SHALL update queue counts and scheduler state from Background events without requiring a manual refresh.

#### Scenario: Update on queue event
- **WHEN** Background broadcasts a `queue:updated` or `*:scheduler` event
- **THEN** the Options page SHALL update the displayed queue counts and scheduler state

#### Scenario: Update on task events
- **WHEN** Background broadcasts a `task:*` event
- **THEN** the Options page SHALL update the affected task type's progress without a manual refresh

### Requirement: Per-type queue breakdown
The Options page SHALL show AI task queue counts broken down by task type.

#### Scenario: Show classify and rename counts
- **WHEN** the Options page displays queue status
- **THEN** it SHALL show pending, processing, completed, and failed counts separately for `classify` and `rename`

## MODIFIED Requirements

### Requirement: Classification controls section
The Options page SHALL provide controls for AI task processing state and concurrency.

#### Scenario: Show paused state
- **WHEN** AI task processing is paused
- **THEN** the Options page SHALL display the paused state
- **AND** it SHALL provide an action to start task processing

#### Scenario: Start task processing
- **WHEN** the user starts task processing from Options
- **THEN** the Background scheduler SHALL start processing pending tasks
- **AND** the saved configuration SHALL record processing as not paused

#### Scenario: Pause task processing
- **WHEN** the user pauses task processing from Options
- **THEN** the Background scheduler SHALL stop claiming new pending tasks
- **AND** the saved configuration SHALL record processing as paused

#### Scenario: Configure concurrency
- **WHEN** the user changes task concurrency
- **THEN** the system SHALL persist the new concurrency value
- **AND** the active scheduler SHALL use the updated concurrency for future task claims

### Requirement: Queue maintenance section
The Options page SHALL provide queue visibility and maintenance actions for AI tasks.

#### Scenario: Show queue counts
- **WHEN** the Options page displays queue status
- **THEN** it SHALL show counts for pending, processing, failed, and completed tasks for each task type when those counts are available

#### Scenario: Retry failed tasks
- **WHEN** the user triggers retry failed tasks from Options
- **THEN** the system SHALL requeue failed tasks according to existing queue retry behavior
- **AND** the Options page SHALL refresh queue status after the action

#### Scenario: Clear queue with confirmation
- **WHEN** the user triggers clear queue from Options
- **THEN** the UI SHALL require confirmation before clearing queued tasks
- **AND** the Options page SHALL refresh queue status after the action completes
