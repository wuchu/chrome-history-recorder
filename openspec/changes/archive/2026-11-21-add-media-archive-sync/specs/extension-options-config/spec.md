## ADDED Requirements

### Requirement: Media archive task card

The Options Tasks section SHALL provide a media archive card that configures the archive and shows overall archive progress through app RPC.

#### Scenario: Show current archive state
- **WHEN** the Options Tasks section renders and the app is connected
- **THEN** it SHALL show whether archiving is enabled
- **AND** it SHALL show the configured target path and interval
- **AND** it SHALL show the last run time, pending task count, failed task count, and last error when present

#### Scenario: Show overall progress
- **WHEN** archive tasks exist in the queue
- **THEN** the card SHALL show the completed/total task count
- **AND** it SHALL render a progress bar with the completion percentage
- **AND** it SHALL show processing, pending, and failed counts when non-zero
- **AND** it SHALL update from `queue:updated` events

#### Scenario: Task console avoids duplicate archive card
- **WHEN** the task console builds its per-type cards
- **THEN** it SHALL NOT render an archive type card, because the dedicated media archive card shows aggregate archive progress

#### Scenario: Enable and save
- **WHEN** the user enables archiving, enters an absolute target directory, and saves
- **THEN** the Options page SHALL send `updateMediaArchiveConfig` through the Background relay
- **AND** on success it SHALL reflect the saved values

#### Scenario: Show validation failure
- **WHEN** the app rejects the target path
- **THEN** the Options page SHALL display the returned reason
- **AND** it SHALL NOT present the rejected configuration as saved

#### Scenario: Explain only-new semantics
- **WHEN** the media archive card renders
- **THEN** it SHALL state that only media captured after the first enable is archived
- **AND** it SHALL state that files are stored as content-hash names without metadata
- **AND** it SHALL state that each file runs as an archive task counted in the overall progress

#### Scenario: Manual trigger
- **WHEN** the user clicks the manual archive action
- **THEN** the Options page SHALL send `runMediaArchiveNow`
- **AND** it SHALL disable the action while the worker reports `running = true`
- **AND** it SHALL update the displayed status from the response without waiting for copies to finish

#### Scenario: Live status updates
- **WHEN** the app broadcasts `media-archive:status` or `queue:updated`
- **THEN** the media archive card SHALL update its displayed status and progress without a full page reload
