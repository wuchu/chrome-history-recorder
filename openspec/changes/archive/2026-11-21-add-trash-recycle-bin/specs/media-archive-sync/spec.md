## MODIFIED Requirements

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

## ADDED Requirements

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
