## MODIFIED Requirements

### Requirement: File type filtering
The system SHALL only process media files (images and videos).

#### Scenario: Media file detected
- **WHEN** a media file (image or video) is added to the monitored directory
- **THEN** the system SHALL detect the file and add it to the processing queue

#### Scenario: Non-media file ignored
- **WHEN** a non-media file (text, pdf, etc.) is added
- **THEN** the system SHALL silently skip the file without adding to queue

#### Scenario: Supported media extensions
- **WHEN** checking file type
- **THEN** the system SHALL accept: jpg, jpeg, png, gif, webp, bmp (images), mp4 (video)