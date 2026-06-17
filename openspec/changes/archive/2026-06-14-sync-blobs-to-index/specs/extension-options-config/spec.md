## ADDED Requirements

### Requirement: Media index sync action
The Options page SHALL provide a manual action for synchronizing the current VFS workspace `blobs/` directory into the VFS metadata index.

#### Scenario: Trigger blob index sync
- **WHEN** the user triggers the media index sync action from the Options page
- **THEN** the Options page SHALL send a Background runtime message requesting blob index sync
- **AND** the UI SHALL show an in-progress state until the action completes or fails

#### Scenario: Show sync success summary
- **WHEN** the blob index sync action completes successfully
- **THEN** the Options page SHALL show feedback containing the number of newly indexed blobs and skipped existing blobs
- **AND** it SHALL refresh relevant service or queue-visible data when applicable

#### Scenario: Show sync failure
- **WHEN** the blob index sync action fails
- **THEN** the Options page SHALL show an error message
- **AND** it SHALL clear the in-progress state
