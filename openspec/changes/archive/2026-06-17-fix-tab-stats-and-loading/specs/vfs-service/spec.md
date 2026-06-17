# Spec: VFS Service (Delta)

## MODIFIED Requirements

### Requirement: VFS Service provides statistics API

The VFS Service SHALL provide file statistics including total count, size, and breakdown by category.

#### Scenario: Get stats
- **WHEN** Extension calls getStats
- **THEN** VFS Service returns { totalFiles, totalSize, byCategory: { cats: 10, dogs: 5, ... }, images, videos }

### Requirement: VFS Service provides tag counts API

The VFS Service SHALL provide tag usage counts including system tags and user tags.

#### Scenario: Get tag counts
- **WHEN** Extension calls getTagCounts
- **THEN** VFS Service returns { all: <total>, images: <count>, videos: <count>, starred: <count>, uncategorized: <count>, <user-tag>: <count>, ... }

### Requirement: VFS Service provides clear index API

The VFS Service SHALL provide API to clear the SQLite index (delete all records from files and classify_queue tables without deleting physical blobs).

#### Scenario: Clear index
- **WHEN** Extension calls clearIndex
- **THEN** VFS Service deletes all records from files and classify_queue tables in a transaction and returns { success: true }
