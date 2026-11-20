## MODIFIED Requirements

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
