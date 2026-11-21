## ADDED Requirements

### Requirement: AI media eligibility decision

The system SHALL determine whether a media item is eligible for AI vision processing before any task is created, without reading media bytes.

Eligibility SHALL be true when the MIME type is a native vision format (JPEG, PNG, WebP, GIF), a format the bundled thumbnail decoder can rasterize, or a video type handled by the frame-extraction path.

#### Scenario: Native vision format is eligible
- **WHEN** eligibility is evaluated for an `image/jpeg`, `image/png`, `image/webp`, or `image/gif` item
- **THEN** the item SHALL be eligible

#### Scenario: Thumbnail-decodable format is eligible
- **WHEN** eligibility is evaluated for an image MIME type the bundled thumbnail decoder can read, such as `image/tiff`
- **THEN** the item SHALL be eligible
- **AND** the classifier SHALL be permitted to use the generated thumbnail as its representative image

#### Scenario: Video is eligible subject to runtime extraction
- **WHEN** eligibility is evaluated for a `video/*` item
- **THEN** the item SHALL be eligible
- **AND** a later frame-extraction failure SHALL be reported as permanent unprocessable media rather than as ineligibility at enqueue time

#### Scenario: Format with no decodable path is ineligible
- **WHEN** eligibility is evaluated for an image MIME type that is neither a native vision format nor decodable by the bundled thumbnail subsystem, such as `image/x-icon` or `image/bmp`
- **THEN** the item SHALL be ineligible
- **AND** the decision SHALL include a human-readable reason naming the format

#### Scenario: Decoder capability is derived, not assumed
- **WHEN** eligibility is evaluated
- **THEN** the thumbnail-decodable portion of the decision SHALL be derived from the capabilities of the bundled decoder
- **AND** it SHALL NOT rely on a hardcoded MIME allowlist that can drift from the build

### Requirement: One eligibility decision shared by task types

The eligibility decision SHALL apply equally to `classify` and `rename`, so a resource that is ineligible is not processed by one task type while being rejected by the other.

#### Scenario: Both task types agree
- **WHEN** eligibility is evaluated for a media hash
- **THEN** the same decision SHALL govern both the `classify` and `rename` task types for that hash

#### Scenario: Manual paths use the same decision
- **WHEN** a manual enqueue, single-item requeue, retry-failed operation, or full rescan targets a media hash
- **THEN** the system SHALL use the same eligibility decision as automatic ingest

### Requirement: Ineligible media never enters the pending queue

The system SHALL NOT create or reset a task to `pending` for ineligible media through any enqueue path. Ineligible media SHALL be recorded with a terminal skipped outcome carrying the reason.

#### Scenario: Automatic ingest records skipped tasks
- **WHEN** a non-duplicate ineligible file is ingested
- **THEN** the system SHALL record a `skipped` `classify` task and a `skipped` `rename` task with the eligibility reason
- **AND** it SHALL NOT create pending tasks for that hash
- **AND** the scheduler SHALL NOT spend a concurrency slot on it

#### Scenario: Manual enqueue reports the outcome
- **WHEN** a user or client explicitly requests AI processing for ineligible media
- **THEN** the system SHALL record the skipped outcome
- **AND** it SHALL return the reason to the caller so the UI can explain why nothing was queued

#### Scenario: Eligible media still enqueues normally
- **WHEN** an ingested file is eligible
- **THEN** the system SHALL enqueue `classify` and `rename` as pending tasks according to the existing enqueue rules

### Requirement: Permanent unprocessable-media errors

When a representative image cannot be produced at runtime even though the media was eligible, the AI pipeline SHALL raise a typed permanent error that is distinct from transient failures.

The permanent reasons SHALL be `unsupported-format`, `no-representative-frame`, and `invalid-media`.

#### Scenario: Unsupported format at runtime
- **WHEN** a task runs for media whose MIME type cannot produce a representative image
- **THEN** the pipeline SHALL raise a permanent `unsupported-format` error
- **AND** it SHALL NOT send media bytes to Ollama

#### Scenario: No extractable video frame
- **WHEN** a video yields no representative frame
- **THEN** the pipeline SHALL raise a permanent `no-representative-frame` error

#### Scenario: Corrupt media
- **WHEN** decoding the media fails because the bytes are invalid
- **THEN** the pipeline SHALL raise a permanent `invalid-media` error

#### Scenario: Transient failures are not permanent
- **WHEN** Ollama is unreachable, a vision request times out, the model is missing, or the model output is unusable
- **THEN** the failure SHALL remain transient
- **AND** it SHALL be retried according to the existing retry policy

### Requirement: Eligibility is recomputed on every decision

The system SHALL NOT treat a stored skipped outcome as a permanent eligibility verdict. It SHALL recompute eligibility whenever media is requeued, retried, or included in a full rescan.

#### Scenario: Decoder support improves
- **WHEN** a newer build can decode a format that was previously ineligible and the user runs a full rescan or retries the task
- **THEN** the system SHALL re-evaluate eligibility
- **AND** formerly skipped media that is now eligible SHALL become pending work

#### Scenario: Media remains ineligible
- **WHEN** eligibility is recomputed for still-ineligible media
- **THEN** the task SHALL remain skipped
- **AND** it SHALL NOT consume a retry attempt
