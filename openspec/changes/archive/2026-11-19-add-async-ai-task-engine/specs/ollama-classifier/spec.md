## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: Classification output
The system SHALL produce structured classification results focused on tags.

#### Scenario: Return classification data
- **WHEN** classification is complete
- **THEN** the system SHALL return generated tags, resolved canonical tags, and a confidence score
- **AND** it SHALL NOT require a category field

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

## REMOVED Requirements

### Requirement: Multi-tag selection from predefined set
**Reason**: 新的标签体系允许 AI 自生长词表并对近义标签做归并，不再局限于从预定义集合中选择。

**Migration**: 由 "AI-generated tag vocabulary" 与 "Near-synonym canonicalization" 取代；`userDefinedTags` 不再作为词表来源。
