# File Organizer

## Purpose

Standalone CLI output-directory organization (file copying, renaming, category/date directory trees, metadata preservation) is retired. The active VFS workflow stores captured blobs by hash and manages metadata in VFS, and AI naming updates metadata only.

## Requirements

### Requirement: Filesystem output organization is not a supported capability
The system SHALL NOT physically copy, rename, or arrange captured media into category or date-based directory trees on disk.

#### Scenario: No physical reorganization
- **WHEN** the AI classifier produces a category, suggested filename, or tags
- **THEN** the system SHALL update VFS metadata fields without renaming or copying the underlying blob

#### Scenario: Browsing replaces folder structure
- **WHEN** the user wants to navigate captured media by category or date
- **THEN** DevTools filtering and browsing over VFS records SHALL be the supported mechanism instead of filesystem folders

#### Scenario: Metadata preservation through VFS
- **WHEN** capture metadata (timestamps, source URL, MIME type) must be retained
- **THEN** VFS records SHALL preserve that metadata; the system SHALL NOT preserve metadata through file copies
