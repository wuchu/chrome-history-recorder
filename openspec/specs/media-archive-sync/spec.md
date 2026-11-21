# Spec: Media Archive Sync

## Purpose

Copy captured media from the VFS workspace into a user-configured directory on a mounted local filesystem, using the unified task queue for scheduling and retries, without calling cloud provider APIs or requiring credentials.

## Requirements

### Requirement: Archive destination is a mounted local directory

The media archive SHALL copy files to a user-configured directory on a mounted filesystem. It SHALL NOT call cloud provider APIs or require credentials.

#### Scenario: Mounted SMB directory
- **WHEN** the configured target is `/Volumes/personal_folder/Private/VFS-media` on a mounted SMB volume
- **THEN** the worker SHALL copy media files into that directory using the local filesystem API

#### Scenario: Unmounted macOS volume
- **WHEN** the configured target is under `/Volumes/<name>` and `/Volumes/<name>` does not exist
- **THEN** the worker SHALL treat the target as unavailable
- **AND** it SHALL NOT create `/Volumes/<name>` or any directory beneath it

### Requirement: Activation baseline

The worker SHALL record the first time the archive is enabled and SHALL only archive files indexed after that instant.

#### Scenario: First enable
- **WHEN** the user enables the archive for the first time
- **THEN** the app SHALL persist the current time as `activatedAt`

#### Scenario: Files captured before activation
- **WHEN** a file's `created_at` is earlier than `activatedAt`
- **THEN** the worker SHALL NOT archive that file

#### Scenario: Disable and re-enable keeps the baseline
- **WHEN** the user disables the archive and later enables it again
- **THEN** `activatedAt` SHALL remain the original first-enable time
- **AND** files created during the disabled period SHALL be archived after re-enable

#### Scenario: Restart keeps the baseline
- **WHEN** the app restarts
- **THEN** the worker SHALL read `activatedAt` from the persisted state
- **AND** it SHALL NOT reset the baseline

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

### Requirement: Hash-based destination names and atomic writes

The worker SHALL store each archived file as `<hash>.<ext>` directly in the target directory and SHALL make each file appear atomically.

#### Scenario: Destination name
- **WHEN** a file with hash `a1b2c3d4e5f60708` and extension `jpg` is archived
- **THEN** the destination file SHALL be `<target>/a1b2c3d4e5f60708.jpg`

#### Scenario: Already archived
- **WHEN** the destination file exists and its size equals the source size
- **THEN** the worker SHALL skip the copy

#### Scenario: Corrupted destination size
- **WHEN** the destination file exists but its size differs from the source size
- **THEN** the worker SHALL overwrite it using an atomic replace
- **AND** it SHALL log a warning

#### Scenario: Partial copy is not visible
- **WHEN** the worker is copying a file
- **THEN** it SHALL write to a temporary file inside the target directory
- **AND** it SHALL rename that file to the final name only after the copy completes
- **AND** it SHALL remove the temporary file when the copy fails

### Requirement: Infinite failure retry

Archive tasks SHALL retry indefinitely through the task engine with per-task backoff, and a failure SHALL NOT block later files from being archived.

#### Scenario: Copy failure
- **WHEN** copying a file fails
- **THEN** the runner SHALL record the error on the task and increment its attempts
- **AND** the task SHALL return to `pending` with a future `next_run_at`
- **AND** the runner SHALL continue with other due tasks

#### Scenario: Backoff
- **WHEN** a task has failed repeatedly
- **THEN** the delay before the next attempt SHALL grow exponentially
- **AND** it SHALL be capped at one hour
- **AND** the task SHALL NOT become permanently failed

#### Scenario: Retry succeeds
- **WHEN** a previously failed file is copied successfully on a later attempt
- **THEN** the task SHALL become `completed`

#### Scenario: Target unavailable
- **WHEN** the target directory fails validation before a drain
- **THEN** the runner SHALL NOT claim tasks
- **AND** pending tasks SHALL remain pending without consuming attempts

#### Scenario: Source blob missing
- **WHEN** an archive task is due but the file's metadata exists with `is_deleted = 0` and its blob is missing
- **THEN** the task SHALL be marked `completed` and skipped
- **AND** it SHALL NOT retry forever

#### Scenario: Source in the trash
- **WHEN** an archive task's target file is in the trash
- **THEN** the task SHALL remain pending and SHALL NOT be claimed
- **AND** it SHALL resume after the file is restored

#### Scenario: Source permanently deleted
- **WHEN** a trashed file is permanently deleted
- **THEN** its archive task SHALL be removed together with the file row
- **AND** the runner SHALL NOT see a due task for that hash

### Requirement: Destination change backfills since activation

When the configured target directory changes, the worker SHALL make the new target receive every file created since `activatedAt` that the new target does not already contain.

#### Scenario: Target path changes
- **WHEN** the user saves a different target directory
- **THEN** the worker SHALL reset the cursor to `activatedAt`
- **AND** it SHALL requeue existing archive tasks
- **AND** it SHALL enqueue tasks for files created since activation that have none
- **AND** those tasks SHALL copy missing files to the new target

#### Scenario: Same target after restart
- **WHEN** the app restarts with the same target path
- **THEN** the worker SHALL keep the persisted cursor and task states

#### Scenario: Requeue survives restart
- **WHEN** the app restarts while a target-change requeue is in progress
- **THEN** the worker SHALL resume requeueing from the persisted cursor

### Requirement: One-way archive

The archive SHALL be append-only from the source perspective, except that permanently deleting a source file SHALL remove its archived copy.

#### Scenario: Source file updated or trashed
- **WHEN** a file's metadata is updated or the file is moved to the trash
- **THEN** the worker SHALL NOT copy it again
- **AND** it SHALL NOT modify or delete its existing archived copy

#### Scenario: Source file permanently deleted
- **WHEN** a file is permanently deleted and the archive is enabled with a valid target
- **THEN** the worker SHALL remove `<target>/<hash>.<ext>` for that file
- **AND** it SHALL treat a missing copy or unavailable target as a non-fatal condition

#### Scenario: Previous target is not searched
- **WHEN** a file was archived to a target that is no longer the configured target
- **THEN** permanent deletion SHALL only check the current target
- **AND** the archived copy under the previous target SHALL be left untouched

#### Scenario: Duplicate content
- **WHEN** capture deduplication prevents a second file with the same hash from entering the index
- **THEN** the destination SHALL contain at most one copy of that hash

### Requirement: Restored files resume archiving

Restoring a file from the trash SHALL make it eligible for archiving again without duplicating work.

#### Scenario: Restore with an existing archived copy
- **WHEN** a restored file's archived copy already exists in the target with a matching size
- **THEN** its archive task SHALL complete without copying again

#### Scenario: Restore resumes a suspended task
- **WHEN** a file in the trash had a pending archive task
- **THEN** restoring the file SHALL make that task claimable again

#### Scenario: Restore enqueues archiving when enabled
- **WHEN** a file is restored while the archive is enabled and no archive task exists for it
- **THEN** the app SHALL enqueue an archive task for that file

#### Scenario: Archive disabled at restore time
- **WHEN** a file is restored while the archive is disabled
- **THEN** the app SHALL NOT enqueue an archive task
- **AND** enabling the archive later SHALL follow the normal reconciliation rules

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
