## MODIFIED Requirements

### Requirement: Thumbnail-first representative image

The system SHALL prefer a downscaled thumbnail over the full original media when preparing a representative image for a vision request, reading media in-process via `VFSAPI`.

#### Scenario: Prefer thumbnail for vision request
- **WHEN** the classifier prepares a representative image for a vision request
- **THEN** the system SHALL read the thumbnail in-process before the full original
- **AND** it SHALL use the thumbnail when available

#### Scenario: Fall back to original only when thumbnail unavailable and the original is vision-readable
- **WHEN** no thumbnail is available for a media hash
- **THEN** the system SHALL fall back to the original file read in-process only when its MIME type is a native vision format
- **AND** it SHALL NOT read the original as a fallback for formats the vision model cannot consume

#### Scenario: No representative image is a permanent error
- **WHEN** neither a thumbnail nor a vision-readable original can be produced for a media hash
- **THEN** the classifier SHALL raise a permanent unprocessable-media error with a reason
- **AND** it SHALL NOT send media bytes to Ollama

## ADDED Requirements

### Requirement: Eligibility and permanent media errors

The `ai` package SHALL expose AI media eligibility to callers and SHALL distinguish permanent unprocessable-media failures from transient failures.

#### Scenario: Expose eligibility to the app
- **WHEN** the app must decide whether to enqueue AI work for a media MIME type
- **THEN** the `ai` package SHALL provide a pure eligibility decision that does not read media bytes
- **AND** the decision SHALL combine native vision formats, thumbnail-decodable formats supplied by the media layer, and video

#### Scenario: Unsupported format
- **WHEN** a vision request would be prepared for media whose MIME type has no representative-image path
- **THEN** the classifier SHALL raise a permanent `unsupported-format` error
- **AND** the error message SHALL name the MIME type and the affected hash

#### Scenario: No representative video frame
- **WHEN** video frame extraction produces no usable frame
- **THEN** the classifier SHALL raise a permanent `no-representative-frame` error

#### Scenario: Invalid media bytes
- **WHEN** the decoder rejects the stored bytes as invalid
- **THEN** the classifier SHALL raise a permanent `invalid-media` error

#### Scenario: Transient failures stay transient
- **WHEN** the failure is an Ollama connection error, request timeout, missing model, HTTP error, or unusable model output
- **THEN** the classifier SHALL NOT raise a permanent unprocessable-media error
- **AND** the task engine SHALL apply the existing retry policy
