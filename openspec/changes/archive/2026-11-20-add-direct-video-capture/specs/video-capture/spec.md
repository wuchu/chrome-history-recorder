## MODIFIED Requirements

### Requirement: Video request interception

The system SHALL detect network responses for video content when capture is enabled, and SHALL record eligible responses as download candidates whose complete file is later retrieved by the direct video download pipeline.

#### Scenario: MP4 video detected
- **WHEN** a network response returns a `video/mp4` MIME type
- **AND** capture is enabled
- **AND** video capture is enabled in configuration
- **THEN** the system records the response URL as a video download candidate

#### Scenario: WebM video detected
- **WHEN** a network response returns a `video/webm` MIME type
- **AND** capture is enabled
- **AND** video capture is enabled in configuration
- **THEN** the system records the response URL as a video download candidate

#### Scenario: MIME resolved from debugger metadata
- **WHEN** the response `Content-Type` header is absent or reports a generic type such as `application/octet-stream`
- **AND** the debugger-reported MIME type is a supported `video/*` type
- **THEN** the system treats the response as a video candidate

#### Scenario: Whole-resource response
- **WHEN** a detected video response has status `200`
- **THEN** the response is eligible as a download candidate
- **AND** its `Content-Length` is used as the video size

#### Scenario: Ranged response
- **WHEN** a detected video response has status `206`
- **AND** it includes a parseable `Content-Range`
- **THEN** the response is eligible as a download candidate
- **AND** the total size from `Content-Range` is used as the video size
- **AND** the download pipeline retrieves the complete resource rather than the detected range

#### Scenario: Partial response without a usable content range skipped
- **WHEN** a detected video response has status `206`
- **AND** it has no parseable `Content-Range`
- **THEN** the system skips it and broadcasts a skip event containing the URL and reason

#### Scenario: Unsupported URL scheme skipped
- **WHEN** a detected video URL uses `blob:`, `data:`, or any scheme other than `http:` or `https:`
- **THEN** the system skips it and does not create a download candidate

#### Scenario: Duplicate URL ignored
- **WHEN** the same video URL is detected again during the same page session
- **THEN** the system does not create another download candidate

#### Scenario: Video below minimum size skipped
- **WHEN** a detected video's total size is below the configured minimum video size
- **THEN** the system skips it and broadcasts a skip event containing the URL and reason

#### Scenario: Video above maximum size skipped
- **WHEN** a detected video's total size exceeds the configured maximum video size
- **THEN** the system skips it and broadcasts a skip event containing the URL and reason

### Requirement: Video statistics display

The system SHALL display video capture statistics in the media browser side panel.

#### Scenario: Statistics shown
- **WHEN** the media browser side panel is open
- **THEN** the panel displays video capture count, skipped count, failed count, and total size

#### Scenario: Skip reason reported
- **WHEN** a video candidate is skipped
- **THEN** the side panel receives a skip event containing the URL and reason

### Requirement: Video format filtering

The system SHALL allow users to configure which video formats to capture.

#### Scenario: Default formats enabled
- **WHEN** no custom video format configuration is set
- **THEN** the system treats MP4 and WebM responses as video candidates

#### Scenario: Custom format selection
- **WHEN** the user configures enabled video types
- **THEN** the system only records candidates whose resolved MIME type matches an enabled type

#### Scenario: Video capture disabled
- **WHEN** video capture is disabled in configuration
- **THEN** the system does not record any video download candidate
