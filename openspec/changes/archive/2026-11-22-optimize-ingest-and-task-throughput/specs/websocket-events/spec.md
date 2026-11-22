## ADDED Requirements

### Requirement: Tag snapshot events

The app SHALL push tag vocabulary and count snapshots to connected clients as a single event that clients can render without an additional request.

#### Scenario: Emit a tag snapshot
- **WHEN** a classification or tag mutation changes the vocabulary or counts
- **THEN** the system SHALL push a `tags:updated` event
- **AND** the event data SHALL include:
  - `tags`: the vocabulary records needed by the UI
  - `counts`: the tag counts keyed by tag name, including `all`, `image`, `video`, `starred`, and `uncategorized`
- **AND** a client SHALL be able to update its tag tabs and counts from this payload alone

#### Scenario: Coalesce tag snapshots
- **WHEN** multiple classifications finish within the coalescing window
- **THEN** the system SHALL push at most one `tags:updated` event per window
- **AND** the pushed payload SHALL reflect the latest vocabulary and counts

#### Scenario: Task lifecycle events are not coalesced
- **WHEN** a task starts, completes, retries, fails, or is skipped
- **THEN** the task lifecycle event SHALL be pushed immediately
- **AND** it SHALL NOT be merged into a tag or queue snapshot
