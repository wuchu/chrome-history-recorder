## ADDED Requirements

### Requirement: Directory monitoring
The system SHALL monitor a specified input directory for file changes.

#### Scenario: New file detected
- **WHEN** a new file is added to the monitored directory
- **THEN** the system SHALL detect the file and add it to the processing queue

#### Scenario: File type filtering
- **WHEN** a file is added with an unsupported extension
- **THEN** the system SHALL ignore the file and not add it to the queue

#### Scenario: Recursive directory monitoring
- **WHEN** recursive mode is enabled
- **THEN** the system SHALL monitor all subdirectories

### Requirement: Watcher configuration
The system SHALL allow users to configure the watcher behavior.

#### Scenario: Configure file patterns
- **WHEN** user specifies file patterns (glob)
- **THEN** the system SHALL only monitor files matching the patterns

#### Scenario: Configure ignored patterns
- **WHEN** user specifies ignored patterns
- **THEN** the system SHALL exclude files matching those patterns

### Requirement: Watcher events
The system SHALL handle watcher events gracefully.

#### Scenario: Handle file rename
- **WHEN** a file is renamed in the monitored directory
- **THEN** the system SHALL detect the rename and update the queue accordingly

#### Scenario: Handle file delete
- **WHEN** a file is deleted from the monitored directory
- **THEN** the system SHALL remove it from the queue if pending