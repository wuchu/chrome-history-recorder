# Media Library Export

## Purpose

Export a user-selected set of media library items as a single zip archive built in the Options page from the existing HTTP file endpoint, with readable file names, a metadata manifest, per-file progress, and safe size limits.

## Requirements

### Requirement: Selected media export as a zip

The media library SHALL export a user-selected set of media items as a single zip archive built in the Options page from the existing HTTP file endpoint.

#### Scenario: Export selected items
- **WHEN** the user selects one or more media items and chooses export
- **THEN** the Media Library SHALL fetch each selected original over the VFS HTTP file endpoint
- **AND** it SHALL add each fetched blob to a zip archive

#### Scenario: Manifest is included
- **WHEN** an export archive is produced
- **THEN** the archive SHALL contain a `metadata.json` entry
- **AND** the manifest SHALL contain, for each exported file: hash, MIME type, size, captured time, source URL, tags, user notes, star state, AI filename, confidence, and model

#### Scenario: Manifest matches the archive
- **WHEN** a file is included in the zip
- **THEN** the manifest SHALL contain exactly one record for that hash
- **AND** every manifest record SHALL correspond to a file entry in the archive

#### Scenario: Empty selection
- **WHEN** the user requests an export with no selected items
- **THEN** the system SHALL NOT produce an archive
- **AND** it SHALL show a message that at least one item must be selected

#### Scenario: Missing blob during export
- **WHEN** an original blob cannot be read during export
- **THEN** the export SHALL continue with the remaining items
- **AND** the failed hash SHALL be reported to the user as a skipped item
- **AND** the failure SHALL NOT be represented as a manifest record for a file that is absent from the archive

### Requirement: Export file names are readable and safe

Exported entries SHALL use the AI filename when available and SHALL remain valid and collision-free inside the archive.

#### Scenario: AI filename is used
- **WHEN** a media item has an `ai_filename` and a known extension
- **THEN** the zip entry SHALL be named `<ai_filename>.<ext>`
- **AND** the extension SHALL be derived from the stored MIME type or original blob extension

#### Scenario: Fallback name
- **WHEN** a media item has no `ai_filename`
- **THEN** the zip entry SHALL be named `<hash>.<ext>`

#### Scenario: Duplicate display names
- **WHEN** two selected items map to the same entry name
- **THEN** the later entry SHALL receive a numeric suffix such as `name (2).ext`
- **AND** both entries SHALL be present in the archive

#### Scenario: Unsafe characters
- **WHEN** an AI filename contains path separators, control characters, leading/trailing dots or spaces, a reserved Windows device name, or exceeds the maximum entry-name length
- **THEN** the entry name SHALL be sanitized before being added to the archive
- **AND** the sanitized name SHALL NOT escape the archive root

### Requirement: Export progress and cancellation

The export flow SHALL report progress per file and SHALL allow the user to cancel before the archive is saved.

#### Scenario: Per-file progress
- **WHEN** the export is running
- **THEN** the UI SHALL show the number of completed items and the total
- **AND** it SHALL show the name of the item currently being processed

#### Scenario: User cancels
- **WHEN** the user cancels an in-progress export
- **THEN** the system SHALL stop fetching further items
- **AND** it SHALL NOT save a partial archive

#### Scenario: Save completed archive
- **WHEN** all items have been processed
- **THEN** the system SHALL save the zip through the browser download mechanism
- **AND** it SHALL use a filename containing the export date

### Requirement: Export size is bounded

The export flow SHALL enforce a selection cap so a large selection cannot exhaust the Options tab's memory.

#### Scenario: Selection exceeds the cap
- **WHEN** the selected item count or estimated total size exceeds the configured export cap
- **THEN** the system SHALL refuse to start the export
- **AND** it SHALL explain the cap and ask the user to narrow the selection

#### Scenario: Selection is within the cap
- **WHEN** the selection is within the configured cap
- **THEN** the export SHALL proceed without an extra confirmation
