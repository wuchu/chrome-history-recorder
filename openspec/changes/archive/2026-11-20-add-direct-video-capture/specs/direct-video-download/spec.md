## ADDED Requirements

### Requirement: Complete-file download

The system SHALL download the complete file for every video candidate by requesting the candidate URL without a `Range` header, rather than reading a response body captured from the page's own media request.

#### Scenario: Redirected direct video downloaded
- **WHEN** a video candidate URL returns an HTTP redirect
- **THEN** the system follows the redirect and downloads the final response body completely

#### Scenario: Content type determined from the download response
- **WHEN** the download response reports a MIME type different from the type suggested by the URL or the page's `<source>` declaration
- **THEN** the system uses the download response MIME type to select the stored file extension and system tag

#### Scenario: Non-video download response rejected
- **WHEN** the download response is not a `2xx` status or does not report a supported `video/*` MIME type
- **THEN** the candidate fails and the failure is reported with the URL and reason

#### Scenario: Partial download response rejected
- **WHEN** the full download request still returns status `206`
- **THEN** the candidate fails and the failure is reported with the URL and reason

#### Scenario: Download body verified as complete
- **WHEN** the download response completes normally with status `200`
- **THEN** the system treats the received body as the complete file and does not attempt to read the page's original response body

### Requirement: Download execution context

The system SHALL execute video downloads in an extension page context that is independent of the background service worker's idle lifecycle.

#### Scenario: Side panel closed during download
- **WHEN** the side panel is closed while a video download is in progress
- **THEN** the download continues to completion

#### Scenario: Service worker suspended during download
- **WHEN** the background service worker becomes idle while a video download is in progress
- **THEN** the download continues and its result is still recorded

#### Scenario: Browser network stack used
- **WHEN** a video is downloaded
- **THEN** the request uses the browser's network stack so that configured proxies and network routing apply

### Requirement: Streaming upload

The system SHALL stream downloaded media to the VFS service when the runtime accepts streaming request bodies, and SHALL fall back to a buffered upload when the streaming request is rejected.

#### Scenario: Upload begins before download finishes
- **WHEN** a video download is in progress and streaming is available
- **THEN** the system begins transmitting received bytes to the VFS service before the download response completes

#### Scenario: Large file memory use
- **WHEN** a video larger than the previous image size limit is downloaded and streaming is available
- **THEN** extension memory usage does not grow in proportion to the total file size

#### Scenario: Streaming rejected by the runtime
- **WHEN** the streaming upload request fails with a network-level error
- **THEN** the system re-downloads the complete resource and retries the upload with a buffered body
- **AND** the buffered upload is subject to the same size limit

### Requirement: Download concurrency and queueing

The system SHALL limit concurrent video downloads and queue additional candidates.

#### Scenario: Concurrency limit reached
- **WHEN** the number of active video downloads reaches the configured concurrency limit
- **THEN** further candidates wait in a first-in-first-out queue

#### Scenario: Queue cleared on navigation
- **WHEN** the captured tab navigates or closes
- **THEN** pending video candidates for that tab are discarded

#### Scenario: Identical content deduplicated
- **WHEN** two different URLs resolve to content with the same SHA-256 hash
- **THEN** only one file is stored and the second download result is reported as a duplicate

### Requirement: Post-capture processing

The system SHALL integrate downloaded videos into the existing capture pipeline.

#### Scenario: Successful video capture
- **WHEN** a video upload completes without a duplicate
- **THEN** the background broadcasts a `file:captured` event
- **AND** the background enqueues the paired classify and rename tasks for the stored hash

#### Scenario: Duplicate video capture
- **WHEN** a video upload completes as a duplicate
- **THEN** the background does not broadcast a new capture event and does not enqueue tasks

### Requirement: Failure and skip reporting

The system SHALL report video download failures and skips without retrying automatically.

#### Scenario: Download failure
- **WHEN** a candidate download or upload fails
- **THEN** the background broadcasts a capture error event containing the URL and reason
- **AND** the capture failed count increases

#### Scenario: Candidate skip
- **WHEN** a candidate is skipped because of size, format, scheme, or eligibility
- **THEN** the background broadcasts a skip event containing the URL and reason
- **AND** the capture skipped count increases

### Requirement: Streaming media exclusion

The system SHALL exclude adaptive-streaming and in-memory media sources from direct video download.

#### Scenario: Blob source excluded
- **WHEN** a video element uses a `blob:` URL or Media Source Extensions
- **THEN** the system does not create a video candidate from that source

#### Scenario: Segment resource excluded
- **WHEN** an adaptive-streaming segment is served as a standalone small video response
- **THEN** the minimum size rule rejects it
- **AND** URL deduplication prevents the same segment from being captured repeatedly
- **AND** there is no hard per-page candidate cap
