## MODIFIED Requirements

### Requirement: Ollama API integration

The system SHALL integrate with the local Ollama API from the `ai` package for media classification.

#### Scenario: Connect to Ollama
- **WHEN** the app initializes the `ai` package
- **THEN** the system SHALL connect to the configured Ollama endpoint with default `http://localhost:11434`

#### Scenario: Health check
- **WHEN** classification starts or the user checks Ollama status from the UI
- **THEN** the system SHALL verify Ollama availability through the app's `ai` package

#### Scenario: Connection failure
- **WHEN** Ollama service is unavailable
- **THEN** the system SHALL keep queue controls usable where possible and report Ollama unavailable status to the UI

### Requirement: Model configuration

The system SHALL allow users to configure the vision model, including selecting from models discovered from the configured local Ollama endpoint, through the Options UI, stored in app configuration.

#### Scenario: Specify model
- **WHEN** the user selects or enters a specific model name
- **THEN** the `ai` package SHALL use that model for future classification

#### Scenario: Default model selection
- **WHEN** no model is configured
- **THEN** the system SHALL use the default vision model

#### Scenario: Discover installed models
- **WHEN** the user refreshes Ollama models from the UI
- **THEN** the app SHALL query the configured Ollama endpoint and return installed model names
- **AND** the system SHALL NOT persist a different selected model as a side effect of discovery

#### Scenario: Select discovered model
- **WHEN** the user selects a discovered model in the Options UI
- **THEN** the system SHALL immediately persist the selected model in app configuration
- **AND** subsequent classification requests SHALL use the selected model

#### Scenario: Refresh models preserves user selection
- **WHEN** the user refreshes the installed model list after explicitly selecting a model
- **THEN** the system SHALL preserve the currently configured model
- **AND** the system SHALL NOT overwrite it with a preferred or recommended model

#### Scenario: Startup preserves user selection
- **WHEN** the app starts with an existing configured model
- **THEN** the system SHALL preserve the configured model
- **AND** startup model discovery SHALL NOT overwrite it

#### Scenario: Discovery failure preserves current model
- **WHEN** model discovery fails because Ollama is unavailable or returns an invalid response
- **THEN** the system SHALL preserve the currently configured model
- **AND** the system SHALL report the discovery failure to the UI

#### Scenario: Configured model missing from discovery results
- **WHEN** model discovery succeeds and the configured model is not present in the returned model list
- **THEN** the system SHALL keep the configured model
- **AND** the UI SHALL indicate that the configured model is not currently installed or available

### Requirement: Non-blocking vision request encoding

The system SHALL encode media payloads for Ollama vision requests without synchronously blocking the app process event loop.

#### Scenario: Large media payload does not block the process
- **WHEN** the classifier encodes a large media payload for a vision request
- **THEN** the encoding SHALL be performed in bounded chunks
- **AND** the encoder SHALL yield to the event loop between chunks
- **AND** app event handling SHALL remain responsive during encoding

#### Scenario: Encoding correctness preserved
- **WHEN** a media payload is encoded with the chunked encoder
- **THEN** the resulting base64 SHALL be identical to a whole-buffer base64 encoding of the same bytes

### Requirement: Thumbnail-first representative image

The system SHALL prefer a downscaled thumbnail over the full original media when preparing a representative image for a vision request, reading media in-process via `VFSAPI`.

#### Scenario: Prefer thumbnail for vision request
- **WHEN** the classifier prepares a representative image for a vision request
- **THEN** the system SHALL read the thumbnail in-process before the full original
- **AND** it SHALL use the thumbnail when available

#### Scenario: Fall back to original only when thumbnail unavailable
- **WHEN** no thumbnail is available for a media hash
- **THEN** the system SHALL fall back to the original file read in-process
