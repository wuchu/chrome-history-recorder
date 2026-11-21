## ADDED Requirements

### Requirement: Side Panel page scan action

The Side Panel SHALL provide a user-initiated "抓取本页" action for the active tab.

#### Scenario: Action availability
- **WHEN** the Side Panel renders in any state
- **THEN** it SHALL show the 抓取本页媒体 action as a top-right icon
- **AND** the action SHALL be available in both the start state and an active cockpit
- **AND** it SHALL NOT be duplicated as a text button in the start card

#### Scenario: Start a scan
- **WHEN** the user clicks 抓取本页
- **THEN** the Side Panel SHALL request a scan of the active tab
- **AND** it SHALL show a loading state while the scan runs

#### Scenario: Preview candidates
- **WHEN** the scan returns candidates
- **THEN** the Side Panel SHALL open a preview modal with the candidate list
- **AND** each candidate SHALL show a thumbnail, known dimensions, known size, and source kind
- **AND** the modal SHALL show the selected count and the total count

#### Scenario: Select and save
- **WHEN** the user toggles candidates and chooses to save
- **THEN** the Side Panel SHALL save only the selected candidates
- **AND** it SHALL show per-item progress and a final saved / duplicate / skipped / failed summary

#### Scenario: Empty scan
- **WHEN** no eligible candidates are found
- **THEN** the Side Panel SHALL show an empty state with the skip reasons

#### Scenario: VFS disconnected
- **WHEN** the local VFS is not connected
- **THEN** the 抓取本页 action SHALL be disabled
- **AND** the Side Panel SHALL offer the existing reconnect action

#### Scenario: Preview is not the global library
- **WHEN** the scan preview is open
- **THEN** it SHALL show only candidates from the current scan
- **AND** it SHALL NOT show global historical media or global tag filter tabs
- **AND** closing the preview SHALL discard the candidate list

### Requirement: Side Panel shows one-shot save feedback

The Side Panel SHALL surface one-shot save outcomes without mixing them into the capture session.

#### Scenario: Context-menu save with panel open
- **WHEN** a context-menu save completes while the Side Panel is open
- **THEN** the Side Panel SHALL show a toast with the saved or failed result

#### Scenario: Context-menu save with panel closed
- **WHEN** a context-menu save completes while the Side Panel is closed
- **THEN** the extension action badge SHALL indicate success or failure briefly

#### Scenario: No session pollution
- **WHEN** a one-shot save succeeds
- **THEN** the item SHALL NOT appear in the session live feed or session event log
- **AND** the session counters SHALL NOT change
