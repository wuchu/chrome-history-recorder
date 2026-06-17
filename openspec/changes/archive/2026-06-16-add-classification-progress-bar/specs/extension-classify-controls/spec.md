## MODIFIED Requirements

### Requirement: DevTools exposes classification scheduler controls
The extension SHALL allow users to start and pause AI classification processing from the Side Panel and the dedicated Options page. The Side Panel controls SHALL use a compact, single-line layout with Ant Design Progress, Button (size="small"), and Tooltip components.

#### Scenario: Start classification processing
- **WHEN** the user clicks the classification start control
- **THEN** the Side Panel or Options page SHALL send a start request to the Background Service Worker
- **AND** the Background Service Worker SHALL set the classification scheduler to running
- **AND** pending classification tasks SHALL become eligible for processing

#### Scenario: Pause classification processing
- **WHEN** the user clicks the classification pause control
- **THEN** the Side Panel or Options page SHALL send a pause request to the Background Service Worker
- **AND** the Background Service Worker SHALL stop the scheduler from claiming additional pending tasks
- **AND** tasks already in processing SHALL be allowed to complete or fail normally

#### Scenario: Show scheduler control state
- **WHEN** the Side Panel or Options page renders classification progress
- **THEN** it SHALL display whether classification processing is running or paused
- **AND** it SHALL display the next valid action for the current state
- **AND** the Side Panel SHALL display a progress bar showing completion percentage
