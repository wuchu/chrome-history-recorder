## MODIFIED Requirements

### Requirement: Archive work runs as tasks in the unified queue

Each new media file SHALL be represented by an `archive` task in the unified task table, and a dedicated runner SHALL consume those tasks independently of AI scheduling.
The runner SHALL process up to `mediaArchiveConcurrency` archive tasks concurrently.

#### Scenario: New capture enqueues a task
- **WHEN** archiving is enabled and a non-duplicate file is captured
- **THEN** the app SHALL create an `archive` task for that file
- **AND** the task SHALL appear with the other task types in queue status

#### Scenario: Task states
- **WHEN** an archive task is enqueued and processed
- **THEN** its status SHALL transition from `pending` to `processing`
- **AND** it SHALL become `completed` after the file is archived

#### Scenario: AI tasks paused
- **WHEN** `classifyPaused`, `renamePaused`, or both are true
- **THEN** the archive runner SHALL continue to claim and process archive tasks

#### Scenario: Ollama unavailable
- **WHEN** Ollama is unavailable
- **THEN** the archive runner SHALL continue to claim and process archive tasks

#### Scenario: Task isolation
- **WHEN** the AI scheduler claims tasks
- **THEN** it SHALL only claim its own `classify` and `rename` tasks
- **AND** the archive runner SHALL only claim `archive` tasks

#### Scenario: Reconciliation enqueues missed files
- **WHEN** the worker starts, is enabled, or its interval elapses
- **THEN** it SHALL enqueue archive tasks for files with `created_at` after the persisted cursor
- **AND** it SHALL skip files with `is_deleted = 1`
- **AND** enqueueing SHALL be idempotent for existing tasks

#### Scenario: Default serial processing
- **WHEN** `mediaArchiveConcurrency` is `1` and multiple archive tasks are pending
- **THEN** the runner SHALL process them one at a time

#### Scenario: Concurrent processing
- **WHEN** `mediaArchiveConcurrency` is `N` greater than `1` and multiple archive tasks are pending
- **THEN** the runner SHALL process at most `N` archive tasks concurrently

#### Scenario: Concurrency limit applies to copies
- **WHEN** the runner already has `N` copies in flight
- **THEN** it SHALL NOT claim another archive task until one copy finishes

## ADDED Requirements

### Requirement: Archive concurrency configuration

The archive configuration SHALL include `mediaArchiveConcurrency`, an integer with a default of `1` and a supported range of `1–8`.

#### Scenario: Default archive concurrency
- **WHEN** the persisted configuration does not contain `mediaArchiveConcurrency`
- **THEN** the app SHALL load it as `1`

#### Scenario: Clamp archive concurrency
- **WHEN** a persisted or updated value is below `1`, above `8`, or not an integer
- **THEN** the app SHALL clamp or floor it into the `1–8` range

#### Scenario: Apply archive concurrency
- **WHEN** the user changes `mediaArchiveConcurrency`
- **THEN** the runner SHALL apply the new limit to subsequent claims without restarting
- **AND** copies already in flight SHALL be allowed to finish

#### Scenario: Expose archive concurrency
- **WHEN** the extension requests archive status or configuration
- **THEN** the response SHALL include `mediaArchiveConcurrency`

### Requirement: Archive enabled state controls processing

The media archive SHALL use its enabled state as the archive task type's independent run/pause control.

#### Scenario: Disable stops claiming
- **WHEN** the archive is disabled
- **THEN** the runner SHALL stop claiming new archive tasks
- **AND** it SHALL NOT enqueue archive tasks for newly captured files

#### Scenario: In-flight copies finish
- **WHEN** the archive is disabled while copies are in flight
- **THEN** those copies SHALL be allowed to finish
- **AND** no new copies SHALL start

#### Scenario: Re-enable resumes and catches up
- **WHEN** the user re-enables the archive
- **THEN** the worker SHALL reconcile files created since the persisted cursor
- **AND** it SHALL resume processing archive tasks

#### Scenario: AI pause is independent
- **WHEN** the archive is enabled and both AI task types are paused
- **THEN** the archive runner SHALL continue processing archive tasks
