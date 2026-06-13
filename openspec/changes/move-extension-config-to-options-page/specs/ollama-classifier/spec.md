## MODIFIED Requirements

### Requirement: Model configuration
The system SHALL allow users to configure the AI model, including selecting from models discovered from the configured local Ollama endpoint.

#### Scenario: Specify model
- **WHEN** user configures a specific model name
- **THEN** the system SHALL use that model for classification

#### Scenario: Default model selection
- **WHEN** no model is configured
- **THEN** the system SHALL use llava for images and llama3 for text

#### Scenario: Discover installed models
- **WHEN** model discovery is requested
- **THEN** the system SHALL call GET `{ollamaEndpoint}/api/tags`
- **AND** the system SHALL return the installed model names from the response
- **AND** the system SHALL NOT persist a different selected model as a side effect of discovery

#### Scenario: Select discovered model
- **WHEN** the user selects a discovered model in the extension Options UI
- **THEN** the system SHALL immediately persist the selected model in extension configuration
- **AND** subsequent classification requests SHALL use the selected model

#### Scenario: Refresh models preserves user selection
- **WHEN** the user refreshes the installed model list after explicitly selecting a model
- **THEN** the system SHALL preserve the currently configured model
- **AND** the system SHALL NOT overwrite it with a preferred or recommended model

#### Scenario: Startup preserves user selection
- **WHEN** the Background service worker starts with an existing configured model
- **THEN** the system SHALL preserve the configured model
- **AND** startup model discovery SHALL NOT overwrite it with a preferred or recommended model

#### Scenario: Discovery failure preserves current model
- **WHEN** model discovery fails because Ollama is unavailable or returns an invalid response
- **THEN** the system SHALL preserve the currently configured model
- **AND** the system SHALL report the discovery failure to the UI

#### Scenario: Configured model missing from discovery results
- **WHEN** model discovery succeeds and the configured model is not present in the returned model list
- **THEN** the system SHALL keep the configured model
- **AND** the UI SHALL indicate that the configured model is not currently installed or available
