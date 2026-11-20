# Extension Options Config

## Purpose

Provide a dedicated extension Options page as the source of truth for active Extension Background and VFS runtime configuration.

## Requirements

### Requirement: Dedicated extension options page
The extension SHALL provide a dedicated Options page for active program configuration.

#### Scenario: Open extension options
- **WHEN** the user opens the extension Options page
- **THEN** the system SHALL render a configuration UI for the active Extension Background + VFS runtime
- **AND** the UI SHALL be available as the extension options entrypoint

#### Scenario: Use Ant Design components
- **WHEN** the Options page renders configuration controls or feedback
- **THEN** the UI SHALL use Ant Design components for forms, cards, buttons, selectors, switches, status indicators, feedback messages, and confirmation dialogs
- **AND** extension UI code SHALL NOT use native `window.alert` or `alert` for user-facing feedback

### Requirement: Options page config source of truth
The Options page SHALL read and update active program configuration through the app, which is the source of truth.

#### Scenario: Load current configuration
- **WHEN** the Options page initializes
- **THEN** it SHALL request the current configuration from the app via the Background relay
- **AND** it SHALL populate controls from the returned values

#### Scenario: Persist configuration update
- **WHEN** the user changes a supported setting
- **THEN** the Options page SHALL persist the change through app RPC
- **AND** the app SHALL apply the changed setting to active runtime components

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
- **THEN** the system SHALL persist the endpoint to app configuration
- **AND** future Ollama health checks and classification requests SHALL use the configured endpoint

#### Scenario: Select Ollama model
- **WHEN** the user selects a model from the model selector
- **THEN** the system SHALL immediately persist the selected model to app configuration
- **AND** subsequent classification requests SHALL use the selected model

#### Scenario: Refresh model list
- **WHEN** the user refreshes the model list
- **THEN** the Options page SHALL display installed models returned from the configured Ollama endpoint via the app
- **AND** refreshing the list SHALL NOT change the saved selected model

### Requirement: Classification controls section
The Options page SHALL provide controls for AI task processing state and concurrency.

#### Scenario: Show paused state
- **WHEN** AI task processing is paused
- **THEN** the Options page SHALL display the paused state
- **AND** it SHALL provide an action to start task processing

#### Scenario: Start task processing
- **WHEN** the user starts task processing from Options
- **THEN** the app scheduler SHALL start processing pending tasks
- **AND** the saved app configuration SHALL record processing as not paused

#### Scenario: Pause task processing
- **WHEN** the user pauses task processing from Options
- **THEN** the app scheduler SHALL stop claiming new pending tasks
- **AND** the saved app configuration SHALL record processing as paused

#### Scenario: Configure concurrency
- **WHEN** the user changes task concurrency
- **THEN** the system SHALL persist the new concurrency value to app configuration
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
The Options page SHALL provide queue visibility and maintenance actions for AI tasks.

#### Scenario: Show queue counts
- **WHEN** the Options page displays queue status
- **THEN** it SHALL show counts for pending, processing, failed, and completed tasks for each task type when those counts are available

#### Scenario: Retry failed tasks
- **WHEN** the user triggers retry failed tasks from Options
- **THEN** the system SHALL requeue failed tasks according to existing queue retry behavior
- **AND** the Options page SHALL refresh queue status after the action

#### Scenario: Clear queue with confirmation
- **WHEN** the user triggers clear queue from Options
- **THEN** the UI SHALL require confirmation before clearing queued tasks
- **AND** the Options page SHALL refresh queue status after the action completes

### Requirement: Live queue updates
The Options page SHALL update queue counts and scheduler state from Background events without requiring a manual refresh.

#### Scenario: Update on queue event
- **WHEN** Background broadcasts a `queue:updated` or `*:scheduler` event
- **THEN** the Options page SHALL update the displayed queue counts and scheduler state

#### Scenario: Update on task events
- **WHEN** Background broadcasts a `task:*` event
- **THEN** the Options page SHALL update the affected task type's progress without a manual refresh

### Requirement: Per-type queue breakdown
The Options page SHALL show AI task queue counts broken down by task type.

#### Scenario: Show classify and rename counts
- **WHEN** the Options page displays queue status
- **THEN** it SHALL show pending, processing, completed, and failed counts separately for `classify` and `rename`

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

### Requirement: Video capture settings section

The Options page SHALL provide a video capture settings section for the active capture runtime.

#### Scenario: Toggle video capture
- **WHEN** the user enables or disables video capture
- **THEN** the system persists the setting to extension configuration
- **AND** the active capture runtime immediately starts or stops treating video responses as download candidates

#### Scenario: Configure maximum video size
- **WHEN** the user sets a maximum video size
- **THEN** the system persists the value to extension configuration
- **AND** video candidates larger than the new value are skipped

#### Scenario: Select enabled video formats
- **WHEN** the user selects the video formats to capture
- **THEN** the system persists the selected MIME types to extension configuration
- **AND** the active capture runtime only records candidates matching the selected formats

#### Scenario: Reject invalid maximum size
- **WHEN** the user enters a maximum video size outside the supported range or not a number
- **THEN** the Options page shows a validation error
- **AND** the invalid value is not persisted

#### Scenario: Default video settings
- **WHEN** the Options page loads with no saved video settings
- **THEN** it displays video capture enabled, a maximum size of 200 MiB, and MP4 and WebM selected
