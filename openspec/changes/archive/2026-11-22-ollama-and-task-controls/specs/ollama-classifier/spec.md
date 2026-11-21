## ADDED Requirements

### Requirement: Chat request concurrency limit

The system SHALL limit the number of concurrent `POST /api/chat` requests to the configured `ollamaMaxConcurrency`, defaulting to `1`.
Requests above the limit SHALL wait in a first-in, first-out queue.
`GET /api/tags` requests for health checks and model discovery SHALL NOT count toward this limit.

#### Scenario: Single chat request by default
- **WHEN** `ollamaMaxConcurrency` is `1` and two classify or rename operations start
- **THEN** the system SHALL send only one `/api/chat` request at a time
- **AND** the second request SHALL remain queued until the first finishes

#### Scenario: Queue preserves order
- **WHEN** multiple operations are waiting for a chat slot
- **THEN** the system SHALL grant slots in arrival order

#### Scenario: Control-plane requests are exempt
- **WHEN** a long `/api/chat` request is in flight
- **THEN** a health check or model listing MAY issue `/api/tags` concurrently
- **AND** it SHALL NOT wait for a chat slot

#### Scenario: Queue time does not consume request timeout
- **WHEN** a chat request waits for a slot before being sent
- **THEN** the system SHALL start the request timeout only after the slot is acquired
- **AND** the queued time SHALL NOT count toward the timeout

#### Scenario: Failure releases the slot
- **WHEN** a chat request fails, times out, or is aborted
- **THEN** the system SHALL release its slot
- **AND** the next queued request SHALL become eligible

#### Scenario: Adjust capacity without restart
- **WHEN** the user changes `ollamaMaxConcurrency`
- **THEN** the system SHALL apply the new capacity to subsequent and queued requests
- **AND** it SHALL NOT cancel requests already in flight
