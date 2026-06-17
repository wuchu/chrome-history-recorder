# Clear Index Functionality

## Purpose

Provide a way to clear the SQLite metadata index (both files and classify_queue tables) while preserving physical blob files, allowing users to rebuild the index from scratch.

## Requirements

### Requirement: Clear index operation
The VFS Service SHALL provide an operation to clear all metadata from the SQLite index.

#### Scenario: Clear both files and classify_queue tables
- **WHEN** the clear index operation is invoked
- **THEN** the system SHALL delete all rows from the `classify_queue` table
- **AND** the system SHALL delete all rows from the `files` table
- **AND** the operation SHALL be atomic (using a database transaction)

#### Scenario: Do not delete physical files
- **WHEN** the clear index operation completes
- **THEN** the system SHALL NOT delete, modify, or rename any files in the `blobs/` directory
- **AND** the system SHALL NOT delete, modify, or rename any files in the `thumbnails/` directory

#### Scenario: Return success status
- **WHEN** the clear index operation completes
- **THEN** the system SHALL return a success status

### Requirement: WebSocket API for clear index
The VFS WebSocket Server SHALL expose the clear index operation via a WebSocket API method.

#### Scenario: clearIndex WebSocket method
- **WHEN** a WebSocket client sends a request with `method: "clearIndex"`
- **THEN** the system SHALL invoke the clear index operation
- **AND** the system SHALL return a success response

### Requirement: Extension UI for clear index
The Extension Options page SHALL provide a UI button to trigger the clear index operation.

#### Scenario: Clear index button in media index card
- **WHEN** the user navigates to the Extension Options page
- **THEN** the "媒体索引维护" card SHALL display a "清空索引" button alongside the existing "同步原始媒体到索引" button

#### Scenario: Require confirmation before clearing
- **WHEN** the user clicks the "清空索引" button
- **THEN** the system SHALL display a confirmation dialog
- **AND** the dialog SHALL explain that physical files will not be deleted
- **AND** the dialog SHALL require explicit user confirmation before proceeding

#### Scenario: Do not auto-sync after clear
- **WHEN** the clear index operation completes successfully
- **THEN** the system SHALL NOT automatically trigger a sync operation
- **AND** the user SHALL be able to manually trigger sync by clicking the "同步原始媒体到索引" button

### Requirement: Extension runtime integration
The Extension runtime SHALL provide a way to invoke the clear index operation from the Options page.

#### Scenario: Extension runtime clearIndex function
- **WHEN** the Options page invokes `clearIndex()` via the extension runtime
- **THEN** the system SHALL send the message to the background service worker
- **AND** the background service worker SHALL invoke the VFS WebSocket client `clearIndex()` method
- **AND** the result SHALL be returned to the Options page
