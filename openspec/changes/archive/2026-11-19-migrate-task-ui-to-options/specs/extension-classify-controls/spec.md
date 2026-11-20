## MODIFIED Requirements

### Requirement: DevTools exposes classification scheduler controls
The extension SHALL allow users to start and pause AI classification processing from the dedicated Options page.

#### Scenario: Start classification processing
- **WHEN** the user clicks the classification start control
- **THEN** the Options page SHALL send a start request to the Background Service Worker
- **AND** the Background Service Worker SHALL set the classification scheduler to running
- **AND** pending classification tasks SHALL become eligible for processing

#### Scenario: Pause classification processing
- **WHEN** the user clicks the classification pause control
- **THEN** the Options page SHALL send a pause request to the Background Service Worker
- **AND** the Background Service Worker SHALL stop the scheduler from claiming additional pending tasks
- **AND** tasks already in processing SHALL be allowed to complete or fail normally

#### Scenario: Show scheduler control state
- **WHEN** the Options page renders task progress
- **THEN** it SHALL display whether task processing is running or paused
- **AND** it SHALL display the next valid action for the current state
- **AND** it SHALL display a progress bar showing completion percentage

### Requirement: DevTools exposes queue maintenance actions
The extension SHALL expose queue maintenance actions for failed and queued AI tasks from the Options page.

#### Scenario: Retry failed tasks
- **WHEN** the user clicks retry failed tasks
- **THEN** the Options page SHALL request Background to retry failed queue entries
- **AND** Background SHALL reset failed tasks to pending through VFS
- **AND** queue status SHALL refresh after the operation

#### Scenario: Clear classification queue
- **WHEN** the user clicks clear queue and confirms the action
- **THEN** the Options page SHALL request Background to clear the task queue through VFS
- **AND** queue status SHALL refresh after the operation
