## ADDED Requirements

### Requirement: Trashed media is not processed

The app scheduler SHALL NOT process AI tasks for media that is in the trash, and SHALL resume them automatically after restore.

#### Scenario: Skip trashed targets
- **WHEN** the scheduler claims pending tasks
- **THEN** it SHALL skip tasks whose target file is in the trash
- **AND** it SHALL continue processing other eligible tasks

#### Scenario: Resume after restore
- **WHEN** a file is restored from the trash
- **THEN** its suspended tasks SHALL become eligible for the next claim cycle
- **AND** the scheduler SHALL NOT require a restart or manual requeue

#### Scenario: No repeated failures for trashed media
- **WHEN** pending tasks exist for trashed files
- **THEN** the scheduler SHALL NOT claim them into repeated failures
- **AND** queue status SHALL NOT report them as active pending work

#### Scenario: Permanent delete cleans scheduler state
- **WHEN** a trashed file is permanently deleted
- **THEN** the scheduler SHALL no longer report tasks for that hash
- **AND** any completed task records for it SHALL be removed with the file row
