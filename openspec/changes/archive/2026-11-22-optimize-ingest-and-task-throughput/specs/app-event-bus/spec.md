## ADDED Requirements

### Requirement: Coalesce high-frequency status events

The app event bus SHALL coalesce snapshot-style status events so that a burst of task transitions produces a bounded number of messages while preserving the latest state.

#### Scenario: Queue snapshot burst
- **WHEN** multiple task transitions occur within the coalescing window
- **THEN** the app SHALL emit at most one `queue:updated` event per window
- **AND** the emitted event SHALL contain the latest queue counts and scheduler state
- **AND** it SHALL NOT emit one queue snapshot per task transition

#### Scenario: Tag snapshot burst
- **WHEN** multiple classifications update tags within the coalescing window
- **THEN** the app SHALL emit at most one `tags:updated` event per window
- **AND** it SHALL compute the tag list and counts once at flush time
- **AND** the event SHALL contain the latest vocabulary and counts

#### Scenario: Archive status burst
- **WHEN** multiple archive tasks complete within the coalescing window
- **THEN** the app SHALL emit at most one `media-archive:status` event per window
- **AND** the emitted event SHALL contain the latest status

#### Scenario: Lifecycle events stay immediate
- **WHEN** a task starts, completes, retries, fails, or is skipped
- **THEN** the corresponding task lifecycle event SHALL be emitted immediately
- **AND** it SHALL NOT be delayed by a pending status-event window

#### Scenario: File events stay immediate
- **WHEN** a file is captured, trashed, restored, or purged
- **THEN** the corresponding file event SHALL be emitted immediately
- **AND** it SHALL NOT be coalesced with status snapshots

#### Scenario: Final state is flushed
- **WHEN** a coalescing window ends after a burst
- **THEN** the app SHALL flush the latest snapshot at the end of the window
- **AND** a consumer that reconnects or reads after the burst SHALL see the final state

#### Scenario: Ordering within each class
- **WHEN** events of the same class are emitted
- **THEN** they SHALL be delivered in production order per connected client
- **AND** a coalesced snapshot MAY carry state newer than an earlier lifecycle event, because it always represents the latest counts

## MODIFIED Requirements

### Requirement: Push events to the extension

The app SHALL forward bus events to the extension through the `vfs` transport. Snapshot-style status events SHALL be coalesced per the coalescing requirement; lifecycle and file events SHALL be forwarded immediately.

#### Scenario: Forward a task event
- **WHEN** the event bus receives a task lifecycle event
- **THEN** the app SHALL push it over the WebSocket to connected extension clients without waiting for a coalescing window

#### Scenario: Forward a coalesced snapshot
- **WHEN** a queue, tag, or archive snapshot window flushes
- **THEN** the app SHALL push one event containing the latest snapshot over the WebSocket
- **AND** it SHALL NOT push every intermediate snapshot produced during the window

#### Scenario: Serialized delivery
- **WHEN** multiple events are published
- **THEN** the app SHALL deliver them in order per connected client
