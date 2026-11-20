## ADDED Requirements

### Requirement: Workspace storage settings section

The Options Settings section SHALL provide a workspace storage card that shows and edits the VFS workspace path through app RPC.

#### Scenario: Show current workspace state
- **WHEN** the Options Settings section renders and the app is connected
- **THEN** it SHALL show the current workspace path
- **AND** it SHALL show the resolution source as one of CLI argument, environment variable, launcher configuration, or default
- **AND** it SHALL show the default workspace path

#### Scenario: Show pending path and restart requirement
- **WHEN** the app reports a `pendingPath` different from the current path
- **THEN** the card SHALL show the pending path
- **AND** it SHALL state that the running backend still writes to the current path and that a backend restart is required

#### Scenario: Save a new workspace path
- **WHEN** the user enters an absolute path and saves
- **THEN** the Options page SHALL send `setWorkspacePath` through the Background relay
- **AND** on success it SHALL show a success message stating that a backend restart is required
- **AND** it SHALL refresh the displayed pending path

#### Scenario: Show validation failure
- **WHEN** the app rejects a workspace path
- **THEN** the Options page SHALL display the returned reason
- **AND** it SHALL NOT present the rejected path as saved or pending

#### Scenario: Read-only under startup override
- **WHEN** the app reports the workspace source as CLI argument or environment variable
- **THEN** the card SHALL disable editing and saving
- **AND** it SHALL explain that the startup argument or environment variable takes precedence

#### Scenario: Warn when switching to a new workspace
- **WHEN** the user saves a path that will initialize a new empty workspace
- **THEN** the UI SHALL warn that application configuration returns to defaults, including paused classification
- **AND** it SHALL state that the previous workspace and its configuration remain in place
- **AND** it SHALL require explicit confirmation before sending the update

#### Scenario: Copy the current path
- **WHEN** the user requests to copy the current workspace path
- **THEN** the Options page SHALL copy the absolute path to the clipboard
- **AND** it SHALL provide feedback that the path was copied
