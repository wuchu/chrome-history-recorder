## MODIFIED Requirements

### Requirement: Buffered assembly progress events
The system SHALL report buffered assembly state as session-scoped events suitable for live display.

#### Scenario: Assembling progress
- **WHEN** bytes are committed to an assembly job
- **THEN** the Background emits an assembling event containing the source URL, received byte count, and total byte count
- **AND** the event rate is throttled so that rapid chunk writes do not flood the session log

#### Scenario: Buffered video complete
- **WHEN** an assembly job finalizes successfully
- **THEN** the Background emits a buffered video complete event containing the hash, size, MIME type, source URL, and whether the content was a duplicate

#### Scenario: Buffered video skipped
- **WHEN** an assembly job is discarded
- **THEN** the Background emits a buffered video skipped event containing the source URL, reason, missing byte count when applicable, and bounded diagnostic detail
- **AND** the detail is omitted or empty when no diagnostic information is available

#### Scenario: Source verification skip is distinguishable from byte incompleteness
- **WHEN** the skip reason is `unverified-source`
- **THEN** the event detail describes the source-verification outcome and matching attempts
- **AND** the missing byte count is absent
- **AND** the user-visible event label does not claim that received bytes are incomplete

#### Scenario: Diagnostic detail is bounded
- **WHEN** a skip event includes diagnostic detail
- **THEN** the detail is truncated to a bounded length suitable for the session event log
- **AND** the detail does not include the complete signed query string

#### Scenario: Assembly events are bounded by the session log
- **WHEN** assembling events exceed the session log capacity
- **THEN** older entries are discarded according to the bounded event log rule
