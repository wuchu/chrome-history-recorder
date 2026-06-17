## ADDED Requirements

### Requirement: Dedicated extension options page
The extension SHALL provide a dedicated Options page for active program configuration.

#### Scenario: Open extension options
- **WHEN** the user opens the extension Options page
- **THEN** the system SHALL render a configuration UI for the active Extension Background + VFS runtime
- **AND** the UI SHALL be available as the extension options entrypoint

#### Scenario: Use Ant Design components
- **WHEN** the Options page renders configuration controls
- **THEN** the UI SHALL use Ant Design components for forms, cards, buttons, selectors, switches, status indicators, and feedback messages

### Requirement: Options page config source of truth
The Options page SHALL read and update active program configuration through Background runtime messages backed by `vfsConfig`.

#### Scenario: Load current configuration
- **WHEN** the Options page initializes
- **THEN** it SHALL request the current configuration from the Background service worker
- **AND** it SHALL populate controls from the returned `vfsConfig` values

#### Scenario: Persist configuration update
- **WHEN** the user changes a supported setting in the Options page
- **THEN** the Options page SHALL persist the change through a Background configuration update message
- **AND** the Background service worker SHALL apply the changed setting to active runtime components

#### Scenario: Report save failure
- **WHEN** a configuration update fails
- **THEN** the Options page SHALL show an error message
- **AND** it SHALL NOT silently present the failed value as successfully saved

### Requirement: Service status settings section
The Options page SHALL show service connectivity and runtime status for the active local services.

#### Scenario: Show VFS status
- **WHEN** the Options page displays service status
- **THEN** it SHALL show whether the VFS WebSocket service is connected

#### Scenario: Show Ollama status
- **WHEN** the Options page displays service status
- **THEN** it SHALL show whether the configured Ollama endpoint is available

#### Scenario: Refresh service status
- **WHEN** the user requests a service status refresh
- **THEN** the Options page SHALL request fresh status from the Background service worker
- **AND** it SHALL update the displayed status indicators

### Requirement: Ollama settings section
The Options page SHALL provide Ollama endpoint and model controls for the active classifier.

#### Scenario: Edit Ollama endpoint
- **WHEN** the user changes the Ollama endpoint
- **THEN** the system SHALL persist the endpoint to extension configuration
- **AND** future Ollama health checks and classification requests SHALL use the configured endpoint

#### Scenario: Select Ollama model
- **WHEN** the user selects a model from the Options page model selector
- **THEN** the system SHALL immediately persist the selected model to extension configuration
- **AND** subsequent classification requests SHALL use the selected model

#### Scenario: Refresh model list
- **WHEN** the user refreshes the model list
- **THEN** the Options page SHALL display installed models returned from the configured Ollama endpoint
- **AND** refreshing the list SHALL NOT change the saved selected model

### Requirement: Classification controls section
The Options page SHALL provide controls for AI classification processing state and concurrency.

#### Scenario: Show paused state
- **WHEN** classification processing is paused
- **THEN** the Options page SHALL display the paused state
- **AND** it SHALL provide an action to start classification processing

#### Scenario: Start classification
- **WHEN** the user starts classification from Options
- **THEN** the Background scheduler SHALL start processing pending tasks
- **AND** the saved configuration SHALL record classification as not paused

#### Scenario: Pause classification
- **WHEN** the user pauses classification from Options
- **THEN** the Background scheduler SHALL stop claiming new pending tasks
- **AND** the saved configuration SHALL record classification as paused

#### Scenario: Configure concurrency
- **WHEN** the user changes classification concurrency
- **THEN** the system SHALL persist the new concurrency value
- **AND** the active scheduler SHALL use the updated concurrency for future task claims

### Requirement: Filename style settings section
The Options page SHALL provide controls for AI filename generation style.

#### Scenario: Select filename style
- **WHEN** the user selects a filename style
- **THEN** the system SHALL persist the style to extension configuration
- **AND** subsequent classification prompts SHALL use the configured style

#### Scenario: Configure custom style prompt
- **WHEN** the user enters a custom filename style prompt
- **THEN** the system SHALL persist the prompt to extension configuration
- **AND** subsequent classification prompts SHALL use the configured prompt where applicable

### Requirement: Queue maintenance section
The Options page SHALL provide queue visibility and maintenance actions for classification tasks.

#### Scenario: Show queue counts
- **WHEN** the Options page displays queue status
- **THEN** it SHALL show counts for pending, processing, failed, and completed classification tasks when those counts are available

#### Scenario: Retry failed tasks
- **WHEN** the user triggers retry failed tasks from Options
- **THEN** the system SHALL requeue failed classification tasks according to existing queue retry behavior
- **AND** the Options page SHALL refresh queue status after the action

#### Scenario: Clear queue with confirmation
- **WHEN** the user triggers clear queue from Options
- **THEN** the UI SHALL require confirmation before clearing queued tasks
- **AND** the Options page SHALL refresh queue status after the action completes
