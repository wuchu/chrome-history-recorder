## MODIFIED Requirements

### Requirement: Ollama API integration
The system SHALL integrate with local Ollama API from the Extension Background classifier for media classification.

#### Scenario: Connect to Ollama
- **WHEN** the Extension Background classifier is initialized
- **THEN** the system SHALL connect to the configured Ollama endpoint with default `http://localhost:11434`

#### Scenario: Health check
- **WHEN** classification starts or the user checks Ollama status from DevTools
- **THEN** the system SHALL verify Ollama service availability through the Extension Background Ollama client

#### Scenario: Connection failure
- **WHEN** Ollama service is unavailable
- **THEN** the system SHALL keep queue controls usable where possible and report Ollama unavailable status to DevTools

### Requirement: Content analysis
The system SHALL analyze captured media content using Ollama vision models.

#### Scenario: Image classification
- **WHEN** an image file stored in VFS is processed
- **THEN** the system SHALL use the configured vision model to analyze the image content

#### Scenario: Video classification
- **WHEN** a video file stored in VFS is processed and a representative frame is available
- **THEN** the system SHALL use the configured vision model to analyze the visual content

#### Scenario: Generate classification result
- **WHEN** content analysis is complete
- **THEN** the system SHALL return category, suggested filename, tags, and confidence score

### Requirement: Model configuration
The system SHALL allow users to configure the Extension Background vision model through DevTools and stored Extension configuration.

#### Scenario: Specify model
- **WHEN** user selects or enters a specific model name in DevTools
- **THEN** the Extension Background classifier SHALL use that model for future classification

#### Scenario: Default model selection
- **WHEN** no model is configured
- **THEN** the system SHALL use the Extension default vision model

#### Scenario: Discover installed models
- **WHEN** the user refreshes Ollama models from DevTools
- **THEN** the Extension Background SHALL query the configured Ollama endpoint and return installed model names

### Requirement: Classification output
The system SHALL produce structured classification results for VFS media metadata.

#### Scenario: Return classification data
- **WHEN** classification is complete
- **THEN** the system SHALL return category, suggestedName, tags, and confidence
- **AND** the system SHALL update AI-owned VFS metadata fields without physically renaming the blob
