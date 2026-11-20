## ADDED Requirements

### Requirement: Scheduler runs in the app process

The app SHALL run the AI task scheduler as a long-lived loop independent of any browser service worker.

#### Scenario: Continuous operation
- **WHEN** the app process is running
- **THEN** the scheduler SHALL keep claiming and processing tasks without requiring the browser or extension to stay open

#### Scenario: No extension connection required
- **WHEN** no extension is connected to the app
- **THEN** the scheduler SHALL continue processing pending tasks

### Requirement: Claim and dispatch typed tasks

The app scheduler SHALL atomically claim pending tasks, dispatch them to the `classify` and `rename` handlers in the `ai` package, and record completion or failure.

#### Scenario: Claim a pending task
- **WHEN** a concurrency slot is free and a pending task exists
- **THEN** the scheduler SHALL claim it in-process via `VFSAPI` and mark it `processing`

#### Scenario: Run a classify handler
- **WHEN** a claimed `classify` task runs
- **THEN** the scheduler SHALL invoke the `ai` classification handler and write the resulting tags and metadata through `VFSAPI`

#### Scenario: Record failure
- **WHEN** a handler throws
- **THEN** the scheduler SHALL record the failure, increment attempts, and schedule a retry or mark the task failed

### Requirement: Global concurrency limit

The app scheduler SHALL apply a single concurrency limit across all task types.

#### Scenario: Concurrency shared across types
- **WHEN** the concurrency limit is N and N tasks are processing
- **THEN** the scheduler SHALL NOT claim additional tasks of any type until a slot frees

#### Scenario: Adjust concurrency
- **WHEN** the concurrency setting changes
- **THEN** the scheduler SHALL apply the new limit to subsequent claims without restarting

### Requirement: Retry with backoff

The app scheduler SHALL retry failed tasks with bounded exponential backoff.

#### Scenario: Retry a failed task
- **WHEN** a task fails before exhausting `max_attempts`
- **THEN** the scheduler SHALL reschedule it with a backoff delay

#### Scenario: Terminal failure
- **WHEN** a task exhausts `max_attempts`
- **THEN** the scheduler SHALL mark it failed and stop retrying

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

The app SHALL enqueue paired `classify` and `rename` tasks idempotently when a file is ingested.

#### Scenario: Enqueue on save
- **WHEN** a non-duplicate file is stored via `saveFile` or `POST /upload`
- **THEN** the app SHALL enqueue a `classify` task and a `rename` task for its hash

#### Scenario: No enqueue for duplicates
- **WHEN** an ingested file is a duplicate
- **THEN** the app SHALL NOT enqueue new tasks for it
