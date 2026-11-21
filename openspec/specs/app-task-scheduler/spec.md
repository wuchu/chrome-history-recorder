# Spec: App Task Scheduler

## Purpose

Run AI classification and rename tasks in the long-lived app process, independent of the browser and extension.

## Requirements

### Requirement: Scheduler runs in the app process

The app SHALL run the AI task scheduler as a long-lived loop independent of any browser service worker.

#### Scenario: Continuous operation
- **WHEN** the app process is running
- **THEN** the scheduler SHALL keep claiming and processing tasks without requiring the browser or extension to stay open

#### Scenario: No extension connection required
- **WHEN** no extension is connected to the app
- **THEN** the scheduler SHALL continue processing pending tasks

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

### Requirement: Global concurrency limit

The app scheduler SHALL apply a single concurrency limit across all task types.

#### Scenario: Concurrency shared across types
- **WHEN** the concurrency limit is N and N tasks are processing
- **THEN** the scheduler SHALL NOT claim additional tasks of any type until a slot frees

#### Scenario: Adjust concurrency
- **WHEN** the concurrency setting changes
- **THEN** the scheduler SHALL apply the new limit to subsequent claims without restarting

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

### Requirement: Stale task recovery

The app SHALL recover tasks left in `processing` by a previous app instance.

#### Scenario: Recover on startup
- **WHEN** the app starts
- **THEN** the scheduler SHALL reset `processing` tasks to `pending` so they are retried

### Requirement: Paused and running intent

The app SHALL persist the scheduler's running or paused intent in app configuration and honor it across restarts.

#### Scenario: Start processing
- **WHEN** the user starts processing
- **THEN** the app SHALL persist running intent and begin claiming tasks

#### Scenario: Pause processing
- **WHEN** the user pauses processing
- **THEN** the app SHALL persist paused intent, stop claiming new tasks, and let active tasks finish

#### Scenario: Restore intent on startup
- **WHEN** the app restarts with persisted intent
- **THEN** the scheduler SHALL resume running or paused accordingly

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
