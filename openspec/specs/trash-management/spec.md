# Trash Management

## Purpose

Provide a reversible deletion (recycle bin) for captured media: trashing retains the stored artifacts, files can be restored or permanently deleted, and cleanup happens only on explicit user action.

## Requirements

### Requirement: Trash lifecycle operations

The system SHALL provide reversible deletion: a file moves to the trash without removing its stored artifacts, and can later be restored or permanently deleted.

#### Scenario: Move a file to the trash
- **WHEN** a caller invokes `trashFile` with an active file hash
- **THEN** the system SHALL set `is_deleted = 1`, set `deleted_at` to the current time, and update `updated_at`
- **AND** the blob, thumbnails, and archived copy SHALL remain in place
- **AND** the file SHALL disappear from active media listings

#### Scenario: Restore a trashed file
- **WHEN** a caller invokes `restoreFile` with a trashed file hash
- **THEN** the system SHALL set `is_deleted = 0` and clear `deleted_at`
- **AND** the file SHALL reappear in active media listings with its original blob, thumbnails, tags, and metadata

#### Scenario: Restore all trashed files
- **WHEN** a caller invokes `restoreAll`
- **THEN** every trashed file SHALL be restored in a single operation
- **AND** the system SHALL report the number of restored files

#### Scenario: Permanently delete a trashed file
- **WHEN** a caller invokes `purgeFile` with a trashed file hash
- **THEN** the system SHALL remove the blob, all thumbnails for that hash, the archived copy when the archive is enabled, all tasks for that hash, and the `files` row
- **AND** the file SHALL no longer exist in any listing

#### Scenario: Empty the trash
- **WHEN** a caller invokes `emptyTrash`
- **THEN** every trashed file SHALL be permanently deleted
- **AND** the active library and the trash SHALL both be empty of those files afterward
- **AND** the system SHALL report the number of purged files

#### Scenario: Idempotent permanent delete
- **WHEN** a caller invokes `purgeFile` for a hash that is not present
- **THEN** the operation SHALL succeed without error

#### Scenario: Trash a non-existent file
- **WHEN** a caller invokes `trashFile` for a hash that does not exist
- **THEN** the operation SHALL fail and report that the file was not found

### Requirement: Trash retains storage artifacts

While a file is in the trash, the system SHALL retain every storage artifact required to restore or preview it.

#### Scenario: Blob is retained
- **WHEN** a file is in the trash
- **THEN** its blob file SHALL remain under `workspace/blobs/`
- **AND** `getFile` SHALL still return the file contents by hash

#### Scenario: Thumbnails are retained
- **WHEN** a file is in the trash
- **THEN** its cached thumbnails SHALL remain available
- **AND** the trash view SHALL be able to render previews and the detail view

#### Scenario: Archived copy is retained
- **WHEN** a file that was archived is moved to the trash
- **THEN** the archived copy SHALL remain in the archive target
- **AND** the archive worker SHALL NOT modify or remove it

#### Scenario: Trashed media is excluded from active listings
- **WHEN** a caller lists active media
- **THEN** trashed files SHALL NOT be included
- **AND** statistics and tag usage counts SHALL continue to exclude them

### Requirement: Permanent deletion removes all artifacts

Permanent deletion SHALL remove every copy of the media that the system knows about.

#### Scenario: Blob and thumbnails removed
- **WHEN** a file is permanently deleted
- **THEN** its blob SHALL be unlinked from `workspace/blobs/`
- **AND** every thumbnail file for that hash, including the video frame cache, SHALL be unlinked from `workspace/thumbnails/`

#### Scenario: Archived copy removed
- **WHEN** a file is permanently deleted and the media archive is enabled with a valid target
- **THEN** the system SHALL remove the archived copy named `<hash>.<ext>` from the current archive target

#### Scenario: Archive removal is best effort
- **WHEN** the archived copy cannot be removed because the target is unavailable or permission is denied
- **THEN** the permanent deletion of the local file SHALL still succeed
- **AND** the system SHALL record a warning

#### Scenario: Tasks removed
- **WHEN** a file is permanently deleted
- **THEN** all queued, processing, completed, failed, and skipped tasks for that hash SHALL be removed

#### Scenario: Tag usage recomputed
- **WHEN** one or more files are permanently deleted
- **THEN** the system SHALL recompute tag usage counts from the remaining active files

#### Scenario: Unknown archive target
- **WHEN** the archive target path changed after a file was archived
- **THEN** only the current target SHALL be checked for the archived copy
- **AND** copies in previous targets SHALL be left untouched

### Requirement: Automatic restore on duplicate capture

The system SHALL restore a trashed file instead of silently rejecting a re-capture of the same content.

#### Scenario: Re-capture trashed content
- **WHEN** a caller saves content whose hash matches a file currently in the trash
- **THEN** the system SHALL restore that file
- **AND** it SHALL return `{ duplicate: true, restored: true }`
- **AND** it SHALL NOT write a second blob or metadata row

#### Scenario: Restore event is broadcast
- **WHEN** a duplicate capture restores a trashed file
- **THEN** the system SHALL broadcast `file:restored` for that hash
- **AND** the restored file SHALL reappear in active media listings

#### Scenario: Duplicate of an active file
- **WHEN** a caller saves content whose hash matches an active file
- **THEN** the system SHALL keep the existing `{ duplicate: true }` behavior
- **AND** it SHALL NOT emit a restore event

### Requirement: Trash listing and statistics

The system SHALL expose trashed files for the Options media library's trash view.

#### Scenario: List trashed files
- **WHEN** a caller invokes `listFiles` with `status = 'trashed'`
- **THEN** the system SHALL return only trashed files
- **AND** it SHALL order them by `deleted_at` descending by default
- **AND** pagination and `hasMore` SHALL behave like the active listing

#### Scenario: List all files
- **WHEN** a caller invokes `listFiles` with `status = 'all'`
- **THEN** the system SHALL return both active and trashed files
- **AND** the default when `status` is omitted SHALL be `active`

#### Scenario: Trash statistics
- **WHEN** a caller invokes `getStats`
- **THEN** the result SHALL include the trashed file count and trashed storage size separately from active totals
- **AND** the Options media library SHALL use those values for its trash view count and storage summary

### Requirement: Manual-only cleanup

The trash SHALL NOT expire automatically; files SHALL remain recoverable until the user permanently deletes them or empties the trash.

#### Scenario: No automatic purge
- **WHEN** a file has been in the trash for any amount of time
- **THEN** the system SHALL NOT delete it without an explicit purge or empty-trash request

#### Scenario: Disabling the feature has no data effect
- **WHEN** the app is restarted or upgraded
- **THEN** trashed files SHALL remain in the trash with their original `deleted_at` value

### Requirement: Batch trash operations

The media library SHALL move a multi-item selection to the trash in one user action.

#### Scenario: Trash a selection
- **WHEN** the user confirms trashing a multi-item selection
- **THEN** the system SHALL move each selected item to the trash
- **AND** it SHALL remove successfully trashed items from the media grid

#### Scenario: Batch confirmation
- **WHEN** the user requests batch trash
- **THEN** the confirmation SHALL state how many items will move to the trash
- **AND** it SHALL state that they can be restored later

#### Scenario: Partial failure
- **WHEN** some items in the batch cannot be trashed
- **THEN** the system SHALL keep those items in the grid
- **AND** it SHALL report the number of failures and their reasons

#### Scenario: Empty selection
- **WHEN** the user requests batch trash with no selected items
- **THEN** the system SHALL NOT call the trash operation

### Requirement: Selected-item restore and purge

The trash view SHALL support restoring or permanently deleting a selected subset of trashed items.

#### Scenario: Restore selection
- **WHEN** the user selects trashed items and chooses restore
- **THEN** each selected item SHALL be restored
- **AND** successfully restored items SHALL leave the trash list
- **AND** failures SHALL be reported

#### Scenario: Purge selection
- **WHEN** the user selects trashed items and chooses permanent delete
- **THEN** the confirmation SHALL state that the action cannot be undone
- **AND** each selected item, its blob, thumbnails, and archived copy SHALL be removed
- **AND** failures SHALL be reported

#### Scenario: Global actions remain
- **WHEN** the trash view shows its global actions
- **THEN** restore-all and empty-trash SHALL remain available
- **AND** they SHALL apply to the whole trash

#### Scenario: Selection clears on action
- **WHEN** a selected restore or purge completes
- **THEN** the selection SHALL be cleared

### Requirement: Trash surface placement

The trash capability SHALL be exposed through the Options media library's trash view rather than a standalone console page, while preserving every lifecycle operation.

#### Scenario: Trash operations are reachable from the library
- **WHEN** the user opens the media library's trash view
- **THEN** the user SHALL be able to list, restore, permanently delete, restore all, and empty the trash
- **AND** no lifecycle operation SHALL require a separate Trash navigation section

#### Scenario: Trash count is visible before opening the view
- **WHEN** the media library renders its view switch
- **THEN** the trash item count SHALL be visible without opening the trash view
- **AND** the count SHALL update after trash, restore, purge, and empty-trash operations

#### Scenario: Lifecycle events update the view
- **WHEN** a trashed item is restored or permanently deleted from any surface
- **THEN** the trash view SHALL refresh and SHALL NOT show stale items
