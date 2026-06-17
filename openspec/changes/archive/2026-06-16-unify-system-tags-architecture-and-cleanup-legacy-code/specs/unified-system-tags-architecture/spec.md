## ADDED Requirements

### Requirement: System tags are persisted to database
The system SHALL persist system tags ("system:image", "system:video", "system:starred", "system:uncategorized") to the tags field in the database when a file is saved.

#### Scenario: Save image file
- **WHEN** an image file is saved
- **THEN** the tags field SHALL contain "system:image"

#### Scenario: Save video file
- **WHEN** a video file is saved
- **THEN** the tags field SHALL contain "system:video"

#### Scenario: Sync existing blob files
- **WHEN** syncBlobsToIndex is run
- **THEN** all existing files SHALL have appropriate system tags added to their tags field

### Requirement: Unified tag querying
The system SHALL use a unified query logic for all tags, including system tags, by checking the tags field directly without special cases.

#### Scenario: Query by system:image tag
- **WHEN** querying files with tag "system:image"
- **THEN** the system SHALL return files whose tags field contains "system:image"

#### Scenario: Query by system:video tag
- **WHEN** querying files with tag "system:video"
- **THEN** the system SHALL return files whose tags field contains "system:video"

#### Scenario: Query by system:starred tag
- **WHEN** querying files with tag "system:starred"
- **THEN** the system SHALL return files whose tags field contains "system:starred"

#### Scenario: Query by system:uncategorized tag
- **WHEN** querying files with tag "system:uncategorized"
- **THEN** the system SHALL return files whose tags field contains "system:uncategorized"

### Requirement: Unified tag counting
The system SHALL use a unified counting logic for all tags, including system tags, by counting occurrences in the tags field directly without special cases.

#### Scenario: Count system:image tag
- **WHEN** getTagCounts is called
- **THEN** the "system:image" count SHALL be the number of files whose tags field contains "system:image"

#### Scenario: Count system:video tag
- **WHEN** getTagCounts is called
- **THEN** the "system:video" count SHALL be the number of files whose tags field contains "system:video"

### Requirement: Dead code removal
The system SHALL remove unused dead code.

#### Scenario: MediaTabs component removed
- **WHEN** checking the codebase
- **THEN** MediaTabs.tsx and MediaTabs.module.css SHALL NOT exist
