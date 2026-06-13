## MODIFIED Requirements

### Requirement: Queue persistence
The system SHALL persist classification queue state in the VFS Service storage layer so queue status can be resumed and reported after restart.

#### Scenario: Save queue through VFS
- **WHEN** the classification queue is modified
- **THEN** the system SHALL persist the queue state through VFS Service storage
- **AND** it SHALL NOT write standalone `.ai-classify-queue-tasks.json` files

#### Scenario: Load queue on startup
- **WHEN** the Extension Background or VFS Service starts
- **THEN** the system SHALL make the persisted VFS queue status available to Background and DevTools

#### Scenario: Empty queue on first run
- **WHEN** no persisted VFS queue entries exist
- **THEN** the system SHALL report an empty classification queue

### Requirement: Queue operations
The system SHALL support queue operations for media hashes captured and stored in VFS.

#### Scenario: Add to queue
- **WHEN** a new media file is captured and saved to VFS
- **THEN** the system SHALL add its hash to the pending classification queue

#### Scenario: Process next item
- **WHEN** the Background scheduler is running and capacity is available
- **THEN** the system SHALL claim pending VFS queue entries for processing

#### Scenario: Mark complete
- **WHEN** classification succeeds
- **THEN** the system SHALL mark the queue entry as completed and update AI-owned media metadata

#### Scenario: Mark failed
- **WHEN** classification fails
- **THEN** the system SHALL mark the queue entry as failed with an error message

### Requirement: Queue priority
The system SHALL support priority-based processing for VFS classification queue entries.

#### Scenario: Priority queue
- **WHEN** queue entries have different priorities
- **THEN** the Background scheduler SHALL process higher priority entries before lower priority entries when possible

#### Scenario: Default priority
- **WHEN** no priority is specified for a captured media item
- **THEN** the system SHALL use the default classification priority

### Requirement: Queue status
The system SHALL provide queue status information to the DevTools Panel through Background messages and queue events.

#### Scenario: Show queue status
- **WHEN** the DevTools Panel requests queue status
- **THEN** the system SHALL return counts of pending, processing, completed, and failed VFS queue entries
- **AND** it SHALL include scheduler running or paused state

#### Scenario: Refresh queue after actions
- **WHEN** the user starts, pauses, retries, clears, or requeues classification work
- **THEN** the DevTools Panel SHALL refresh queue status from Background

### Requirement: Queue recovery
The system SHALL tolerate missing or unavailable queue storage without exposing standalone CLI queue files.

#### Scenario: VFS unavailable
- **WHEN** the DevTools Panel requests queue status while VFS is unavailable
- **THEN** the system SHALL show an actionable unavailable state instead of reading a local CLI queue file

#### Scenario: VFS queue storage recovers
- **WHEN** VFS connection is restored
- **THEN** the system SHALL resume reporting queue status from VFS storage

## REMOVED Requirements

### Requirement: 任务队列启动处理
**Reason**: Startup scanning of an input directory belongs to the retired standalone `ai-classify start` workflow.
**Migration**: Use Chrome Extension media capture and VFS enqueue behavior; captured media is queued when saved.
