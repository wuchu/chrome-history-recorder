## ADDED Requirements

### Requirement: AI rename task
The system SHALL provide an independent `rename` task type that generates a display filename from media content using the Ollama vision model.

#### Scenario: Generate display filename
- **WHEN** the engine processes a `rename` task for a media hash
- **THEN** it SHALL obtain a representative image and call the Ollama vision model with the configured naming style
- **AND** it SHALL sanitize the result and store it as the media's display filename

#### Scenario: Rename is display-only
- **WHEN** a rename task completes
- **THEN** the system SHALL update only the media metadata display filename
- **AND** it SHALL NOT rename the content-addressed blob file on disk

#### Scenario: Missing media
- **WHEN** a rename task references a hash whose content is unavailable
- **THEN** the task SHALL fail with an actionable error and be retried according to the retry policy

### Requirement: Rename task independence
The rename task SHALL be independent from classification for scheduling, retry, and refresh.

#### Scenario: Independent scheduling
- **WHEN** both `classify` and `rename` tasks exist for a hash
- **THEN** each SHALL be claimed and processed independently under the shared global concurrency limit

#### Scenario: Independent refresh
- **WHEN** the user refreshes the rename task for a hash
- **THEN** only the rename task SHALL be requeued
- **AND** the classification task SHALL keep its current status

#### Scenario: Rename after classification
- **WHEN** classification completes for a hash
- **THEN** it SHALL NOT automatically require or trigger a rename
- **AND** rename SHALL be able to run before, after, or without classification

### Requirement: Rename naming style
The system SHALL apply the user's configured naming style to generated display filenames.

#### Scenario: Respect configured style
- **WHEN** a rename task generates a filename
- **THEN** the prompt SHALL use the configured naming style and language
- **AND** the resulting filename SHALL be sanitized for display

#### Scenario: Empty or invalid model output
- **WHEN** the model returns an empty or unusable filename
- **THEN** the system SHALL keep the existing display filename or fall back to the media hash
- **AND** it SHALL record the failure for retry or diagnostics
