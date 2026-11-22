## MODIFIED Requirements

### Requirement: Source eligibility

The system SHALL exclude media sources whose bytes cannot represent a complete standalone video, and SHALL use layered evidence so that legitimate progressive resources are not rejected because of player implementation details.

#### Scenario: Playlist skipped
- **WHEN** a response MIME type is an HLS or DASH manifest
- **THEN** the system does not create an assembly job
- **AND** the system records a `playlist` skip

#### Scenario: Media segment skipped
- **WHEN** a response is an adaptive-streaming segment such as `video/iso.segment`, `video/mp2t`, or a `.m4s` / `.ts` path
- **THEN** the system does not create an assembly job
- **AND** the system records a `playlist` skip

#### Scenario: MSE source skipped
- **WHEN** every video element across all frames reports a `blob:` or `data:` source
- **AND** the response has no strong network-shape evidence such as `206` with `Content-Range`
- **THEN** the system does not create an assembly job
- **AND** the system records an `in-memory` skip

#### Scenario: Ranged response bypasses source probe
- **WHEN** a video response has status `206` with a parseable `Content-Range`
- **THEN** the system MAY create an assembly job without requiring `<video>` source evidence
- **AND** the system still applies playlist, segment, MIME, and size rules

#### Scenario: Repeated ranges confirm a single resource
- **WHEN** the same resource URL is observed with at least two distinct ranges
- **AND** every response reports the same total size
- **THEN** the system treats the resource as progressive and allows assembly

#### Scenario: Progressive source verified by exact URL
- **WHEN** a video element reports a source matching the media response URL by origin and pathname
- **THEN** the system treats the resource as a progressive source and allows assembly

#### Scenario: Progressive source verified by stable media identifier
- **WHEN** the media response URL and a page video source share a stable identifier such as `__vid`, `aweme_id`, or a path tail of at least 16 characters
- **THEN** the system treats the resource as a progressive source and allows assembly

#### Scenario: Progressive source verified by host-insensitive path
- **WHEN** the media response URL and a page video source share the same pathname but different hosts
- **THEN** the system treats the resource as a progressive source and allows assembly

#### Scenario: Page-scoped media accepted
- **WHEN** the page URL exposes a stable media identifier such as `modal_id`, `aweme_id`, or `/video/<id>`
- **AND** the media URL carries the same identifier in `__vid`
- **THEN** the system treats the resource as the page's focused video and allows assembly

#### Scenario: Page-scoped background media ignored
- **WHEN** the page URL exposes a stable media identifier
- **AND** the media URL carries a different `__vid`
- **THEN** the system does not create an assembly job for that media
- **AND** the system does not emit a user-visible skip event for the background media

#### Scenario: Page identity unavailable
- **WHEN** the page URL has no stable media identifier
- **OR** the media URL has no `__vid` to compare
- **THEN** the system falls back to the other source-eligibility evidence rules

#### Scenario: Unverified source retried
- **WHEN** the system finds no evidence that a response belongs to a progressive source
- **THEN** the system does not create an assembly job for that response
- **AND** the system does not record a terminal skip yet
- **AND** later responses for the same resource are evaluated again

#### Scenario: Unverified source skipped after retry limit
- **WHEN** a resource still has no source evidence after the configured retry budget or time window
- **THEN** the system does not create an assembly job
- **AND** the system records an `unverified-source` skip with diagnostic detail

#### Scenario: Format and size limits enforced
- **WHEN** a resource's MIME type is not enabled or its total size exceeds the configured maximum
- **THEN** the system does not create an assembly job
- **AND** the system records a `size-limit` skip

### Requirement: Skip reporting

The system SHALL report every discarded buffered video with a stable reason and enough diagnostic detail to explain why it was discarded.

#### Scenario: Stable reason values
- **WHEN** a buffered video is discarded
- **THEN** the reason is one of `playlist`, `in-memory`, `unverified-source`, `unknown-total`, `total-mismatch`, `size-limit`, `truncated`, `aborted`, `body-unavailable`, `incomplete`, or `capacity`

#### Scenario: Skip event emitted
- **WHEN** a buffered video is discarded
- **THEN** the system emits a session-scoped skip event containing the source URL, page URL, reason, missing byte count when applicable, and bounded diagnostic detail

#### Scenario: Diagnostic detail content
- **WHEN** a skip event includes diagnostic detail
- **THEN** the detail includes the response status, range or total when available, the source-verification outcome, and the matching strategy that was attempted
- **AND** the detail does not include the complete signed query string

#### Scenario: No automatic retry of byte assembly
- **WHEN** a buffered video is discarded because byte coverage is incomplete
- **THEN** the system MUST NOT retry the resource in the same session
- **AND** the system MUST NOT issue a new network request or re-download

#### Scenario: Source verification retries are not downloads
- **WHEN** a response is skipped because source evidence is unavailable
- **THEN** the system may evaluate later responses for the same resource
- **AND** the system MUST NOT re-read a completed response body or issue a new request to verify the source

### Requirement: Assembly job lifecycle

The system SHALL manage each buffered video as an assembly job owned by the local service.

#### Scenario: Job creation
- **WHEN** the first eligible response for a resource is observed
- **THEN** the extension requests an assembly job with the total size, MIME type, source URL, page URL, and capture time
- **AND** the service returns a job identifier and a one-time token

#### Scenario: Offset-bounded writes
- **WHEN** the extension sends bytes for a job
- **THEN** the service writes them at the requested offset
- **AND** the service rejects writes whose offset plus length exceeds the total size
- **AND** the service records the written interval

#### Scenario: Finalize validates coverage
- **WHEN** the extension requests finalization
- **THEN** the service verifies the recorded intervals cover `[0, total)` without gaps
- **AND** the service rejects finalization when coverage is incomplete

#### Scenario: Server is authoritative
- **WHEN** the extension's local accounting and the service's recorded intervals disagree
- **THEN** the service's coverage result determines whether the resource is saved

#### Scenario: Abort deletes temporary data
- **WHEN** a job is aborted because the session stopped, the tab closed, or the page navigated
- **THEN** the service deletes the temporary assembly file
- **AND** the service releases the job

#### Scenario: Inactive job expiration
- **WHEN** an assembly job has no writes for its configured timeout
- **THEN** the service aborts the job and deletes its temporary file

#### Scenario: Concurrent job limit
- **WHEN** the number of active assembly jobs reaches the configured limit
- **THEN** the service rejects new jobs with a resource-limit error
- **AND** the extension defers the media instead of recording a terminal skip
- **AND** later responses for that resource may retry after capacity becomes available

#### Scenario: Page focus evicts background jobs
- **WHEN** the page URL gains or exposes a stable media identifier
- **AND** an active assembly job belongs to a different media identifier
- **THEN** the extension aborts that background job to free capacity for the focused media
- **AND** the background job's temporary data is deleted

## ADDED Requirements

### Requirement: Source verification diagnostics

The system SHALL retain bounded source-verification diagnostics for skipped buffered videos so that false negatives can be distinguished from genuine MSE or segment sources.

#### Scenario: Verification outcome recorded
- **WHEN** a buffered video is skipped
- **THEN** the system records whether the probing outcome was `progressive`, `mse`, or `unverified`
- **AND** records the number of video sources found across frames and shadow roots

#### Scenario: Matching strategy recorded
- **WHEN** source verification is attempted
- **THEN** the system records whether it matched by exact URL, stable identifier, host-insensitive path, or not at all

#### Scenario: Retry budget recorded
- **WHEN** a resource is skipped after retrying source verification
- **THEN** the diagnostic detail includes the number of attempts and the reason the retry budget was exhausted

### Requirement: Missing-head detection

The system SHALL detect when the first observed range of a buffered video starts after byte 0 and SHALL tell the user that pre-capture buffered bytes cannot be recovered from the debugger session.

#### Scenario: First range starts after zero
- **WHEN** the first observed range for a resource starts at a positive offset
- **THEN** the system emits a buffered assembly progress event with diagnostic detail identifying the missing head byte count

#### Scenario: Gap filling disabled
- **WHEN** missing-head detection fires and optional gap filling is disabled
- **THEN** the progress detail instructs the user to reload the page with capture active
- **AND** the system does not implicitly re-download the missing bytes

#### Scenario: Gap filling enabled
- **WHEN** missing-head detection fires and optional gap filling is enabled
- **THEN** the progress detail indicates that the missing head is being filled
- **AND** the system does not emit the reload hint

#### Scenario: First range starts at zero
- **WHEN** the first observed range starts at byte 0
- **THEN** the system does not emit a missing-head warning

### Requirement: Optional gap filling

When optional gap filling is enabled, the system MAY fetch missing byte ranges from the same media URL using the page's request context, and SHALL NOT download the complete resource again.

#### Scenario: Enabled by default
- **WHEN** the gap-filling setting has no explicit value
- **THEN** optional gap filling is enabled
- **AND** missing ranges may be fetched from the same media URL

#### Scenario: Explicit opt-out
- **WHEN** the user disables optional gap filling
- **THEN** the system MUST NOT issue any additional network request to fill missing ranges
- **AND** an incomplete resource is still discarded at finalization

#### Scenario: Head gap filled immediately
- **WHEN** the first observed range starts after zero and gap filling is enabled
- **THEN** the system starts filling the known head gap when the job is created
- **AND** it does not wait for the normal debounce before the first request

#### Scenario: Cancellation waits for an in-flight fill
- **WHEN** the session stops or the tab navigates while a gap fill is in flight
- **THEN** the system waits up to a short bounded timeout for the fill to finish
- **AND** it finalizes the job if coverage completes during that wait

#### Scenario: Fill only missing ranges
- **WHEN** optional gap filling is enabled and a job has holes
- **THEN** the system computes the missing ranges and requests only those byte ranges from the same media URL
- **AND** the request runs in the page context with the page's referrer
- **AND** it uses the credential mode accepted by the media CDN and may try alternate signed URLs carrying the same stable media identifier

#### Scenario: Chunked range requests
- **WHEN** a missing range exceeds the configured chunk size
- **THEN** the system fetches it in multiple bounded Range requests
- **AND** writes each chunk at its correct offset

#### Scenario: Bounded retry budget
- **WHEN** gap filling fails or leaves holes
- **THEN** the system retries at most the configured number of attempts
- **AND** does not fall back to downloading the complete file

#### Scenario: Idempotent overlapping writes
- **WHEN** the page fetches a range that gap filling also fetched
- **THEN** both writes target the same offsets and produce identical bytes

#### Scenario: Fill failure preserves captured data
- **WHEN** a gap-fill request fails
- **THEN** the system records the failure in the progress detail
- **AND** keeps already captured intervals
- **AND** the resource remains incomplete unless later traffic fills the gap
