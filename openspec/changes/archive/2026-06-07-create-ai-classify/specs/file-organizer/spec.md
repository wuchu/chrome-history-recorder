## ADDED Requirements

### Requirement: File copying
The system SHALL copy files to the target directory without modifying the source.

#### Scenario: Copy file to output
- **WHEN** a file is ready to be organized
- **THEN** the system SHALL copy the file to the configured output directory

#### Scenario: Preserve source file
- **WHEN** organizing is complete
- **THEN** the source file SHALL remain unchanged in the input directory

#### Scenario: Handle copy failure
- **WHEN** copy operation fails (e.g., disk full)
- **THEN** the system SHALL mark the task as failed and log the error

### Requirement: File renaming
The system SHALL rename files based on AI classification results.

#### Scenario: Apply AI suggested name
- **WHEN** classification provides a suggested filename
- **THEN** the system SHALL rename the copied file accordingly

#### Scenario: Handle name conflicts
- **WHEN** target filename already exists
- **THEN** the system SHALL append a unique suffix (e.g., timestamp or counter)

#### Scenario: Preserve extension
- **WHEN** renaming a file
- **THEN** the system SHALL preserve the original file extension

### Requirement: Directory structure
The system SHALL organize files into a structured directory hierarchy.

#### Scenario: Create category directories
- **WHEN** a category is determined
- **THEN** the system SHALL create the corresponding subdirectory if not exists

#### Scenario: Organize by date
- **WHEN** date-based organization is configured
- **THEN** the system SHALL create directories by date (YYYY-MM-DD)

#### Scenario: Organize by category
- **WHEN** category-based organization is configured
- **THEN** the system SHALL create directories by category name

### Requirement: Metadata preservation
The system SHALL preserve file metadata during organization.

#### Scenario: Preserve timestamps
- **WHEN** copying a file
- **THEN** the system SHALL preserve the original file's creation and modification times