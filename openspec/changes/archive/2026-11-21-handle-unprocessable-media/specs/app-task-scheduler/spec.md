## MODIFIED Requirements

### Requirement: Claim and dispatch typed tasks

The app scheduler SHALL atomically claim pending tasks, dispatch them to the `classify` and `rename` handlers in the `ai` package, and record completion, failure, or inapplicability.

#### Scenario: Claim a pending task
- **WHEN** a concurrency slot is free and a pending task exists
- **THEN** the scheduler SHALL claim it in-process via `VFSAPI` and mark it `processing`

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
- **AND** it SHALL release the concurrency slot so other tasks continue

### Requirement: Retry with backoff

The app scheduler SHALL retry transiently failed tasks with bounded exponential backoff and SHALL NOT retry tasks marked skipped.

#### Scenario: Retry a failed task
- **WHEN** a task fails with a transient error before exhausting `max_attempts`
- **THEN** the scheduler SHALL reschedule it with a backoff delay

#### Scenario: Terminal failure
- **WHEN** a task exhausts `max_attempts`
- **THEN** the scheduler SHALL mark it failed and stop retrying

#### Scenario: Skipped tasks are never retried by the scheduler
- **WHEN** a task has status `skipped`
- **THEN** the scheduler SHALL NOT claim it, back it off, or count it against a retry budget

### Requirement: Auto-enqueue on ingest

The app SHALL evaluate AI media eligibility and enqueue paired `classify` and `rename` tasks idempotently when a file is ingested.

#### Scenario: Enqueue on save
- **WHEN** a non-duplicate file is stored via `saveFile` or `POST /upload` and its media is eligible
- **THEN** the app SHALL enqueue a `classify` task and a `rename` task for its hash

#### Scenario: Record skipped tasks for ineligible media
- **WHEN** a non-duplicate ingested file is not eligible for AI vision processing
- **THEN** the app SHALL record both `classify` and `rename` as `skipped` with the reason
- **AND** it SHALL NOT create pending tasks for that hash
- **AND** the file SHALL remain captured, browsable, and archivable

#### Scenario: No enqueue for duplicates
- **WHEN** an ingested file is a duplicate
- **THEN** the app SHALL NOT enqueue new tasks for it

## ADDED Requirements

### Requirement: Eligibility-aware maintenance actions

The app SHALL re-evaluate media eligibility when retrying failed tasks, requeuing a single task, or running a full rescan, and SHALL NOT create pending work for ineligible media through those actions.

#### Scenario: Retry failed skips ineligible rows
- **WHEN** the user retries failed tasks
- **THEN** failed tasks for eligible media SHALL be reset to pending with attempts cleared
- **AND** failed tasks for ineligible media SHALL become `skipped` with the eligibility reason

#### Scenario: Full rescan preserves skipped outcomes
- **WHEN** the user runs a full rescan for a task type
- **THEN** ineligible media SHALL remain or become `skipped`
- **AND** the rescan SHALL NOT reset those rows to pending

#### Scenario: Single-item requeue reports ineligibility
- **WHEN** the user requeues a single media item whose format is ineligible
- **THEN** the app SHALL record the skipped outcome and return an actionable reason
- **AND** it SHALL NOT create a pending task or occupy a scheduler slot

#### Scenario: Eligibility change is picked up by maintenance
- **WHEN** a previously ineligible format becomes eligible after a pipeline upgrade and the user runs a full rescan
- **THEN** the app SHALL promote the skipped task to pending work

### Requirement: Startup reconciliation of ineligible tasks

The app SHALL reconcile persisted tasks with current media eligibility on startup so that work that can never succeed does not remain queued or counted as failed.

#### Scenario: Convert pre-existing ineligible tasks
- **WHEN** the app starts with persisted `pending` or `failed` tasks whose media is ineligible
- **THEN** the app SHALL convert those tasks to `skipped` with the eligibility reason
- **AND** it SHALL leave `completed` and `skipped` tasks unchanged
- **AND** the scheduler SHALL NOT claim the converted tasks before reconciliation completes

#### Scenario: Reconciliation is idempotent
- **WHEN** the app starts and no ineligible pending or failed tasks exist
- **THEN** reconciliation SHALL make no changes
