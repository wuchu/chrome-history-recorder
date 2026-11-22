## MODIFIED Requirements

### Requirement: Video request interception
The system SHALL detect network responses for video content when capture is enabled. The system's handling SHALL depend on the configured capture mode for the page host: `re-download` SHALL record eligible responses as download candidates whose complete file is later retrieved by the direct video download pipeline, and `buffer-only` SHALL record response byte ranges for buffered assembly.

#### Scenario: MP4 video detected
- **WHEN** a network response returns a `video/mp4` MIME type
- **AND** capture is enabled
- **AND** video capture is enabled in configuration
- **THEN** the system handles the response according to the capture mode for the page host

#### Scenario: WebM video detected
- **WHEN** a network response returns a `video/webm` MIME type
- **AND** capture is enabled
- **AND** video capture is enabled in configuration
- **THEN** the system handles the response according to the capture mode for the page host

#### Scenario: MIME resolved from debugger metadata
- **WHEN** the response `Content-Type` header is absent or reports a generic type such as `application/octet-stream`
- **AND** the debugger-reported MIME type is a supported `video/*` type
- **THEN** the system treats the response as a video response

#### Scenario: Whole-resource response in re-download mode
- **WHEN** the page host uses `re-download` mode
- **AND** a detected video response has status `200`
- **THEN** the response is eligible as a download candidate
- **AND** its `Content-Length` is used as the video size

#### Scenario: Whole-resource response in buffer-only mode
- **WHEN** the page host uses `buffer-only` mode
- **AND** a detected video response has status `200`
- **THEN** the system records the interval from `0` to `Content-Length - 1` for buffered assembly
- **AND** no download candidate is created

#### Scenario: Ranged response in re-download mode
- **WHEN** the page host uses `re-download` mode
- **AND** a detected video response has status `206` with a parseable `Content-Range`
- **THEN** the response is eligible as a download candidate
- **AND** the total size from `Content-Range` is used as the video size
- **AND** the download pipeline retrieves the complete resource rather than the detected range

#### Scenario: Ranged response in buffer-only mode
- **WHEN** the page host uses `buffer-only` mode
- **AND** a detected video response has status `206` with a parseable `Content-Range`
- **THEN** the system records the response range and total size for buffered assembly
- **AND** the system MUST NOT re-download the resource
- **AND** the resource is saved only when buffered ranges cover the complete resource

#### Scenario: Partial response without a usable content range skipped
- **WHEN** a detected video response has status `206`
- **AND** it has no parseable `Content-Range`
- **THEN** the system skips it and broadcasts a skip event containing the URL and reason

#### Scenario: Unsupported URL scheme skipped
- **WHEN** a detected video URL uses `blob:`, `data:`, or any scheme other than `http:` or `https:`
- **THEN** the system skips it and does not create a download candidate

#### Scenario: Duplicate URL ignored in re-download mode
- **WHEN** the page host uses `re-download` mode
- **AND** the same video URL is detected again during the same page session
- **THEN** the system does not create another download candidate

#### Scenario: Repeated URL accumulates ranges in buffer-only mode
- **WHEN** the page host uses `buffer-only` mode
- **AND** the same video URL is detected again with a different Range
- **THEN** the system records the new byte range for the same resource
- **AND** the system does not create another assembly job

#### Scenario: Video below minimum size skipped
- **WHEN** a detected video's total size is below the configured minimum video size
- **THEN** the system skips it and broadcasts a skip event containing the URL and reason

#### Scenario: Video above maximum size skipped
- **WHEN** a detected video's total size exceeds the configured maximum video size
- **THEN** the system skips it and broadcasts a skip event containing the URL and reason

#### Scenario: Manifest and segment responses excluded
- **WHEN** a response is an HLS or DASH manifest, or an adaptive-streaming segment
- **THEN** the system does not treat it as a downloadable video
- **AND** the system records a `playlist` skip

#### Scenario: In-memory media excluded
- **WHEN** a media response uses a `blob:` or `data:` URL
- **THEN** the system does not treat it as a downloadable video
- **AND** the system records an `in-memory` skip

## ADDED Requirements

### Requirement: Capture mode selection
The system SHALL select a video capture mode per page host from configuration.

#### Scenario: Global default
- **WHEN** no host-specific override matches the page host
- **THEN** the system uses the configured global video capture mode

#### Scenario: Host override
- **WHEN** a configured host suffix matches the page host
- **THEN** the system uses that host's video capture mode

#### Scenario: Buffer-only host
- **WHEN** the selected mode is `buffer-only`
- **THEN** video responses are processed by buffered assembly
- **AND** the direct video download pipeline is not used for that resource

#### Scenario: Re-download host
- **WHEN** the selected mode is `re-download`
- **THEN** video responses are processed by the existing direct video download pipeline
- **AND** buffered assembly is not used for that resource

#### Scenario: Configuration change
- **WHEN** the video capture mode configuration changes while capture is active
- **THEN** responses observed after the change use the new mode
- **AND** existing assembly jobs retain the mode under which they started
