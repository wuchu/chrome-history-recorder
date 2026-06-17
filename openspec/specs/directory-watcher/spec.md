# Directory Watcher

## Purpose

Filesystem directory monitoring belonged to the retired standalone `ai-classify` CLI. The supported workflow captures media through the Chrome Extension network listener and tracks state through VFS queue events. This spec records that there are no active directory-watcher requirements.

## Requirements

### Requirement: Filesystem directory watching is not a supported capture mechanism
The system SHALL NOT rely on a standalone filesystem directory watcher (input directory monitoring, glob configuration, recursive watching, watcher events) to feed the classification queue.

#### Scenario: No active watcher
- **WHEN** a user wants to capture media for classification
- **THEN** the system SHALL use the Chrome Extension network capture flow
- **AND** the system SHALL NOT provide an active filesystem directory watcher

#### Scenario: Replacement events
- **WHEN** the system needs to react to new captured media
- **THEN** the Extension capture events and VFS queue events SHALL be the supported sources of truth
