## MODIFIED Requirements

### Requirement: Hash index persistence
The system SHALL maintain a hash index as part of the event log state.

#### Scenario: Index stored in event log
- **WHEN** a file is successfully processed
- **THEN** the system SHALL record the hash via COMPLETE event in the event log

#### Scenario: Load hash index on startup
- **WHEN** the system starts
- **THEN** the system SHALL reconstruct the hash index by replaying events

#### Scenario: Index in COMPACT snapshot
- **WHEN** a COMPACT event is written
- **THEN** the COMPACT snapshot SHALL include the full hash index

### Requirement: Duplicate detection
The system SHALL use the hash index to prevent duplicate processing.

#### Scenario: Check hash before processing
- **WHEN** a file is added to the queue
- **THEN** the system SHALL compute its hash and check against the reconstructed index

#### Scenario: Skip duplicate file
- **WHEN** a file's hash exists in the index
- **THEN** the system SHALL skip processing and log a message

#### Scenario: Process new file
- **WHEN** a file's hash does not exist in the index
- **THEN** the system SHALL proceed with processing

### Requirement: Hash computation
The system SHALL compute file hashes using SHA-256.

#### Scenario: Compute file hash
- **WHEN** processing a file
- **THEN** the system SHALL compute SHA-256 hash of the file content

#### Scenario: Hash format
- **WHEN** storing a hash
- **THEN** the system SHALL store the hex-encoded hash string

## REMOVED Requirements

### Requirement: Index file JSON format
**Reason**: Hash index state is now managed by event log, no separate JSON file needed
**Migration**: Old `.ai-classify-index.json` files are no longer used. The system will reconstruct index from event log.

### Requirement: Index file location
**Reason**: No separate index file, index is part of event log state

### Requirement: Old file migration for index
**Reason**: No separate index file to migrate