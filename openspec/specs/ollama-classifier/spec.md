# Ollama Classifier

## Purpose

Integrate the Extension Background classifier with the local Ollama API to analyze captured media and produce structured classification results that update VFS metadata.

## Requirements

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
The system SHALL allow users to configure the Extension Background vision model, including selecting from models discovered from the configured local Ollama endpoint, through DevTools or Options UI and stored Extension configuration.

#### Scenario: Specify model
- **WHEN** user selects or enters a specific model name in DevTools
- **THEN** the Extension Background classifier SHALL use that model for future classification

#### Scenario: Default model selection
- **WHEN** no model is configured
- **THEN** the system SHALL use the Extension default vision model

#### Scenario: Discover installed models
- **WHEN** the user refreshes Ollama models from DevTools
- **THEN** the Extension Background SHALL query the configured Ollama endpoint and return installed model names
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

### Requirement: Classification output
The system SHALL produce structured classification results.

#### Scenario: Return classification data
- **WHEN** classification is complete
- **THEN** the system SHALL return JSON with tags (array), suggestedName, and confidence
- **AND** the category field SHALL be deprecated but still returned for backward compatibility

### Requirement: Tag-aware classification prompt
The system SHALL use user-defined tags in the classification prompt.

#### Scenario: Include available tags in prompt
- **WHEN** building the classification prompt
- **THEN** the system SHALL include the list of user-defined tags as "Available tags"
- **AND** the prompt SHALL instruct the AI to select 1-3 tags from the list

#### Scenario: Prompt format with tags
- **WHEN** the prompt is generated for Chinese
- **THEN** the format SHALL be: "标签1,标签2 | 文件名"
- **WHEN** the prompt is generated for English
- **THEN** the format SHALL be: "TAG1,TAG2 | FILENAME"

### Requirement: Multi-tag selection from predefined set
The system SHALL select tags from the user-defined tag set.

#### Scenario: Parse comma-separated tags
- **WHEN** parsing the AI classification result
- **THEN** the system SHALL split the tag portion by commas
- **AND** the system SHALL trim whitespace from each tag
- **AND** the system SHALL filter out tags not in the user-defined set
- **AND** the system SHALL limit to maximum 3 tags

#### Scenario: Fallback for invalid tags
- **WHEN** AI returns tags not in the user-defined set
- **THEN** the system SHALL ignore invalid tags
- **AND** if no valid tags remain, the system MAY leave user_tags empty
