## REMOVED Requirements

### Requirement: Global concurrency limit

**Reason**: Replaced by independent per-task-type concurrency limits so `classify` and `rename` can be paused and tuned separately.

**Migration**: The legacy `classificationConcurrency` value is migrated to `ollamaMaxConcurrency` by `app-config-store`; `classifyConcurrency` and `renameConcurrency` default to `1`.

## MODIFIED Requirements

### Requirement: Claim and dispatch typed tasks

The app scheduler SHALL atomically claim pending tasks, dispatch them to the `classify` and `rename` handlers in the `ai` package, and record completion, failure, or inapplicability.
Claims SHALL respect the pause state and concurrency limit of the task type being claimed.

#### Scenario: Claim a pending task
- **WHEN** a task type is not paused, a slot for that task type is free, and a pending task of that type exists
- **THEN** the scheduler SHALL claim it in-process via `VFSAPI` and mark it `processing`
- **AND** tasks of other types SHALL NOT consume that task type's slot

#### Scenario: Run a classify handler
- **WHEN** a claimed `classify` task runs
- **THEN** the scheduler SHALL invoke the `ai` classification handler and write the resulting tags and metadata through `VFSAPI`

#### Scenario: Record failure
- **WHEN** a handler throws a transient error
- **THEN** the scheduler SHALL record the failure, increment attempts, and schedule a retry or mark the task failed

#### Scenario: Record unprocessable media
- **WHEN** a handler throws a permanent unprocessable-media error
- **THEN** the scheduler SHALL mark the task `skipped` with the reason
- **AND** it SHALL NOT increment attempts or schedule a retry
- **AND** it SHALL release the task-type slot so other tasks continue

### Requirement: Paused and running intent

The app SHALL persist the running or paused intent for each AI task type in app configuration and honor it across restarts.

#### Scenario: Start a task type
- **WHEN** the user starts `classify` or `rename`
- **THEN** the app SHALL persist that task type as not paused
- **AND** pending tasks of that type SHALL become eligible for processing

#### Scenario: Pause a task type
- **WHEN** the user pauses `classify` or `rename`
- **THEN** the app SHALL persist that task type as paused
- **AND** the scheduler SHALL stop claiming new tasks of that type
- **AND** tasks of that type already processing SHALL be allowed to finish normally

#### Scenario: Pause task types independently
- **WHEN** one AI task type is paused and the other is running
- **THEN** the scheduler SHALL continue claiming tasks of the running type

#### Scenario: Restore intent on startup
- **WHEN** the app restarts with persisted per-type pause state
- **THEN** the scheduler SHALL resume claiming only the task types whose persisted state is not paused

## ADDED Requirements

### Requirement: Per-task-type concurrency limits

The app scheduler SHALL apply an independent concurrency limit to each AI task type it owns.

#### Scenario: Limit applies within a task type
- **WHEN** `classifyConcurrency` is `2` and two `classify` tasks are processing
- **THEN** the scheduler SHALL NOT claim a third `classify` task until one finishes

#### Scenario: One task type does not consume another type's slots
- **WHEN** `renameConcurrency` slots are all busy
- **THEN** the scheduler MAY still claim a `classify` task while its own slots are free

#### Scenario: Adjust one task type
- **WHEN** the user changes `classifyConcurrency` or `renameConcurrency`
- **THEN** the scheduler SHALL apply the new limit to subsequent claims of that type without restarting

#### Scenario: No cross-type starvation
- **WHEN** one task type has a large backlog and the other has a small backlog
- **THEN** each task type SHALL continue to receive claims up to its own limit
