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

#### Scenario: Select discovered model
- **WHEN** the user selects a discovered model in the extension UI
- **THEN** the system SHALL persist the selected model in extension configuration
- **AND** subsequent classification requests SHALL use the selected model

#### Scenario: Discovery failure preserves current model
- **WHEN** model discovery fails because Ollama is unavailable or returns an invalid response
- **THEN** the system SHALL preserve the currently configured model
- **AND** the system SHALL report the discovery failure to the UI
