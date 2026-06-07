## ADDED Requirements

### Requirement: Ollama API integration
The system SHALL integrate with local Ollama API for content classification.

#### Scenario: Connect to Ollama
- **WHEN** the classifier is initialized
- **THEN** the system SHALL connect to the configured Ollama endpoint (default: localhost:11434)

#### Scenario: Health check
- **WHEN** starting classification
- **THEN** the system SHALL verify Ollama service availability

#### Scenario: Connection failure
- **WHEN** Ollama service is unavailable
- **THEN** the system SHALL mark the task as failed and retry later

### Requirement: Content analysis
The system SHALL analyze file content using Ollama models.

#### Scenario: Image classification
- **WHEN** an image file is processed
- **THEN** the system SHALL use a vision model (e.g., llava) to analyze the image content

#### Scenario: Text classification
- **WHEN** a text file is processed
- **THEN** the system SHALL use a text model (e.g., llama3) to analyze the content

#### Scenario: Generate classification result
- **WHEN** content analysis is complete
- **THEN** the system SHALL return category, suggested filename, and confidence score

### Requirement: Model configuration
The system SHALL allow users to configure the AI model.

#### Scenario: Specify model
- **WHEN** user configures a specific model name
- **THEN** the system SHALL use that model for classification

#### Scenario: Default model selection
- **WHEN** no model is configured
- **THEN** the system SHALL use llava for images and llama3 for text

### Requirement: Classification output
The system SHALL produce structured classification results.

#### Scenario: Return classification data
- **WHEN** classification is complete
- **THEN** the system SHALL return JSON with category, suggestedName, tags, and confidence