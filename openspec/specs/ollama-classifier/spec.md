# Ollama Classifier

## Purpose

Integrate the Extension Background classifier with the local Ollama API to analyze captured media and produce structured, tag-focused classification results that update VFS metadata and the AI-owned tag vocabulary.

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
The system SHALL analyze captured media content using Ollama vision models and produce tag-focused results in a single call.

#### Scenario: Image analysis
- **WHEN** an image file stored in VFS is processed for classification
- **THEN** the system SHALL use the configured vision model to generate tags and canonicalize them against the vocabulary in one call

#### Scenario: Video analysis
- **WHEN** a video file stored in VFS is processed and a representative frame is available
- **THEN** the system SHALL use the configured vision model on the frame

#### Scenario: Generate rename result
- **WHEN** a rename task is processed
- **THEN** the system SHALL return a suggested display filename from the vision model

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
The system SHALL produce structured classification results focused on tags.

#### Scenario: Return classification data
- **WHEN** classification is complete
- **THEN** the system SHALL return generated tags, resolved canonical tags, and a confidence score
- **AND** it SHALL NOT require a category field

### Requirement: AI-generated tag vocabulary
The system SHALL allow the Ollama classifier to create new tags beyond a predefined list and persist them in the VFS tag vocabulary.

#### Scenario: Generate new tags
- **WHEN** classification identifies content concepts not present in the current vocabulary
- **THEN** the classifier SHALL be allowed to output new tags
- **AND** the system SHALL persist them as vocabulary entries with `created_by = 'ai'`

#### Scenario: Reuse existing tags
- **WHEN** classification identifies a concept that matches an existing vocabulary tag
- **THEN** the classifier SHALL output the existing canonical tag name
- **AND** the system SHALL link the file to that canonical tag

### Requirement: Near-synonym canonicalization
The system SHALL use Ollama to judge whether newly generated candidate tags are near-synonyms of existing vocabulary tags, and merge them when appropriate.

#### Scenario: Merge near-synonym candidate
- **WHEN** a candidate tag is judged to be a near-synonym of an existing tag
- **THEN** the system SHALL associate the file with the existing canonical tag
- **AND** it SHALL record the candidate as an alias of the canonical tag

#### Scenario: Create tag when no synonym exists
- **WHEN** a candidate tag is judged to have no suitable existing synonym
- **THEN** the system SHALL create a new canonical tag

#### Scenario: Alias cache hit
- **WHEN** a candidate tag has been previously mapped to a canonical tag
- **THEN** the system SHALL reuse the cached mapping without asking the model again

### Requirement: Vocabulary prompt window
The system SHALL limit the tag vocabulary injected into the classification prompt to a bounded top-N set so the prompt stays effective as the vocabulary grows.

#### Scenario: Bound prompt vocabulary
- **WHEN** building the classification prompt
- **THEN** the system SHALL include at most N existing tags, ordered by usage
- **AND** N SHALL be configurable with a safe default

#### Scenario: Candidate outside prompt window
- **WHEN** a candidate matches a vocabulary tag that was not included in the prompt window
- **THEN** the system SHALL still resolve it through normalization and the alias cache where possible

### Requirement: Tag-aware classification prompt
The system SHALL use the AI-owned tag vocabulary in the classification prompt.

#### Scenario: Include available tags in prompt
- **WHEN** building the classification prompt
- **THEN** the system SHALL include a bounded top-N list of existing vocabulary tags
- **AND** the prompt SHALL instruct the model to reuse an existing tag when it is a near-synonym and to mark genuinely new concepts as new tags

#### Scenario: Prompt format with tags
- **WHEN** the prompt is generated
- **THEN** it SHALL define an unambiguous output format for tags, including a marker for new tags
- **AND** it SHALL NOT restrict the model to only predefined tags
