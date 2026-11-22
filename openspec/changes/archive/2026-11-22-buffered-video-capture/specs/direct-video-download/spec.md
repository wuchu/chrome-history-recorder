## MODIFIED Requirements

### Requirement: Complete-file download

When the selected capture mode is `re-download`, the system SHALL download the complete file for every video candidate by requesting the candidate URL without a `Range` header. This capability SHALL NOT apply when the selected capture mode is `buffer-only`.

#### Scenario: Redirected direct video downloaded
- **WHEN** the page host uses `re-download` mode
- **AND** a video candidate URL returns an HTTP redirect
- **THEN** the system follows the redirect and downloads the final response body completely

#### Scenario: Content type determined from the download response
- **WHEN** the page host uses `re-download` mode
- **AND** the download response reports a MIME type different from the type suggested by the URL or the page's `<source>` declaration
- **THEN** the system uses the download response MIME type to select the stored file extension and system tag

#### Scenario: Non-video download response rejected
- **WHEN** the page host uses `re-download` mode
- **AND** the download response is not a `2xx` status or does not report a supported `video/*` MIME type
- **THEN** the candidate fails and the failure is reported with the URL and reason

#### Scenario: Partial download response rejected
- **WHEN** the page host uses `re-download` mode
- **AND** the full download request still returns status `206`
- **THEN** the candidate fails and the failure is reported with the URL and reason

#### Scenario: Download body verified as complete
- **WHEN** the page host uses `re-download` mode
- **AND** the download response completes normally with status `200`
- **THEN** the system treats the received body as the complete file

#### Scenario: Buffer-only mode does not re-download
- **WHEN** the page host uses `buffer-only` mode
- **THEN** the system MUST NOT request the candidate URL from the direct video download pipeline

### Requirement: Streaming media exclusion
The system SHALL exclude adaptive-streaming and in-memory media sources from direct video download and from buffered assembly.

#### Scenario: Blob source excluded
- **WHEN** a video element uses a `blob:` URL or Media Source Extensions
- **THEN** the system does not create a video candidate from that source
- **AND** the system records an `in-memory` skip

#### Scenario: Segment resource excluded
- **WHEN** an adaptive-streaming segment is served as a standalone small video response
- **THEN** the minimum size rule rejects it
- **AND** URL deduplication prevents the same segment from being captured repeatedly
- **AND** the system records a `playlist` skip
- **AND** there is no hard per-page candidate cap

## ADDED Requirements

### Requirement: Re-download mode gating
The direct video download pipeline SHALL operate only for page hosts configured with `re-download` mode.

#### Scenario: Eligible host
- **WHEN** the selected capture mode for the page host is `re-download`
- **THEN** detected video candidates may enter the direct download pipeline

#### Scenario: Ineligible host
- **WHEN** the selected capture mode for the page host is `buffer-only`
- **THEN** detected video responses MUST be handled by buffered assembly
- **AND** no download job is queued

#### Scenario: No fallback after incomplete assembly
- **WHEN** buffered assembly finishes with incomplete coverage in `buffer-only` mode
- **THEN** the system MUST NOT fall back to direct video download for that resource
- **AND** the resource is discarded with an `incomplete` skip
