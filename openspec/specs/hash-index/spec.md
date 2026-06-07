## ADDED Requirements

### Requirement: Hash index persistence
The system SHALL maintain a hash index of processed files.

#### Scenario: Save hash index
- **WHEN** a file is successfully processed
- **THEN** the system SHALL add its hash to the index

#### Scenario: Load hash index on startup
- **WHEN** the system starts
- **THEN** the system SHALL load the existing hash index

#### Scenario: Index file location
- **WHEN** the system initializes
- **THEN** the hash index SHALL be stored in the config file directory
- **AND** the index file SHALL be named `.ai-classify-index.json`

#### Scenario: Old file migration
- **WHEN** old `output/index.json` exists and new `.ai-classify-index.json` does not exist
- **THEN** the system SHALL migrate the old file to the new location

### Requirement: Duplicate detection
The system SHALL use the hash index to prevent duplicate processing.

#### Scenario: Check hash before processing
- **WHEN** a file is added to the queue
- **THEN** the system SHALL compute its hash and check against the index

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

### Requirement: Index operations
The system SHALL support index management operations.

#### Scenario: Clear index
- **WHEN** user runs clear command
- **THEN** the system SHALL reset the hash index

#### Scenario: Query index
- **WHEN** user queries a specific hash
- **THEN** the system SHALL return the corresponding processing record

### Requirement: Index record structure
The system SHALL store detailed records in the hash index.

#### Scenario: Store processing record
- **WHEN** adding a hash to the index
- **THEN** the system SHALL include outputPath, processedAt timestamp, and category