## ADDED Requirements

### Requirement: Video request interception

The system SHALL intercept network requests for video content when capture is enabled.

#### Scenario: MP4 video captured
- **WHEN** a network request returns `video/mp4` MIME type
- **AND** capture is enabled
- **THEN** the system captures the video content

#### Scenario: WebM video captured
- **WHEN** a network request returns `video/webm` MIME type
- **AND** capture is enabled
- **THEN** the system captures the video content

#### Scenario: Video filtered by size
- **WHEN** a video request returns content smaller than configured minimum size
- **THEN** the system skips the video and logs the skip reason

### Requirement: Video content storage

The system SHALL store captured videos using content hash naming for deduplication.

#### Scenario: Video saved with hash filename
- **WHEN** a video is successfully captured
- **THEN** the video is saved with filename `{hash}.{ext}` where hash is SHA-256 truncated to 16 characters

#### Scenario: Duplicate video skipped
- **WHEN** a captured video has the same content hash as an existing file
- **THEN** the system skips saving and marks as duplicate

### Requirement: Video statistics display

The system SHALL display video capture statistics in the DevTools panel.

#### Scenario: Statistics shown
- **WHEN** the DevTools panel is open
- **THEN** the panel displays video capture count, skipped count, failed count, and total size

### Requirement: Video format filtering

The system SHALL allow users to configure which video formats to capture.

#### Scenario: Default formats enabled
- **WHEN** no custom configuration is set
- **THEN** the system captures MP4 and WebM formats by default

#### Scenario: Custom format selection
- **WHEN** user configures enabled video types
- **THEN** the system only captures videos matching the configured types