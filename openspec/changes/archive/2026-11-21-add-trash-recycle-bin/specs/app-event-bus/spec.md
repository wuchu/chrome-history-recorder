## MODIFIED Requirements

### Requirement: App aggregates events

The app SHALL own an event bus that collects file, task, classification, and tag events from the `vfs` layer, the `ai` package, and the scheduler.

#### Scenario: Collect scheduler events
- **WHEN** a task starts, completes, or fails
- **THEN** the scheduler SHALL publish the event into the app event bus

#### Scenario: Collect file events
- **WHEN** a file is captured, moved to the trash, restored, permanently deleted, or the trash is emptied
- **THEN** the corresponding `file:captured`, `file:trashed`, `file:restored`, `file:purged`, `trash:emptied`, or `trash:restored-all` event SHALL enter the app event bus
- **AND** `file:deleted` SHALL NOT be published

#### Scenario: Collect automatic restore events
- **WHEN** a duplicate capture restores a trashed file
- **THEN** a `file:restored` event SHALL enter the app event bus
