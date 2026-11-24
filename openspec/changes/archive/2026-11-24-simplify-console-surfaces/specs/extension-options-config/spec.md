## MODIFIED Requirements

### Requirement: AI prompt template editors
The Options page SHALL provide editable AI prompt templates inside a collapsed advanced disclosure in each AI task card.

#### Scenario: Templates are collapsed by default
- **WHEN** the Options page renders the AI task cards
- **THEN** each card SHALL show an "高级：提示词模板" disclosure in the collapsed state
- **AND** the prompt text areas SHALL NOT occupy space until the user expands it

#### Scenario: Show editable templates
- **WHEN** the user expands the prompt-template disclosure on an AI task card
- **THEN** it SHALL show one text area per prompt type (`classify`, `rename`)
- **AND** each text area SHALL display its current value, defaulting to the built-in default when unset

#### Scenario: Persist a template edit
- **WHEN** the user saves a template
- **THEN** the Options page SHALL persist the change through a Background configuration update message
- **AND** the Background service worker SHALL apply the template to future AI requests

#### Scenario: Show placeholder help
- **WHEN** the Options page displays a template editor
- **THEN** it SHALL show which placeholders the template supports

#### Scenario: Restore a template default
- **WHEN** the user restores a template to default
- **THEN** the Options page SHALL clear the stored override and display the built-in default

#### Scenario: Empty template is valid
- **WHEN** the user clears a template and saves
- **THEN** the Options page SHALL persist the empty value
- **AND** the system SHALL use the built-in default for future requests

### Requirement: Per-task controls section

The Options page SHALL provide independent run/pause and concurrency controls for each task type without duplicating state indicators.

#### Scenario: Show AI task controls
- **WHEN** the Options page renders the AI task cards
- **THEN** the AI 分类 card SHALL show its own run/pause switch and concurrency input
- **AND** the AI 重命名 card SHALL show its own run/pause switch and concurrency input

#### Scenario: Single scheduler state indicator
- **WHEN** an AI task card renders its run/pause state
- **THEN** it SHALL show that state once through the run/pause switch
- **AND** it SHALL NOT repeat the same state as a separate status tag

#### Scenario: Pause one AI task type
- **WHEN** the user pauses AI 分类 while AI 重命名 is running
- **THEN** the page SHALL show AI 分类 as paused and AI 重命名 as running
- **AND** it SHALL persist only the AI 分类 pause state

#### Scenario: Configure per-task concurrency
- **WHEN** the user changes an AI task type's concurrency
- **THEN** the system SHALL persist that task type's concurrency value
- **AND** the active scheduler SHALL use the updated limit for future claims of that type

#### Scenario: Show default paused state
- **WHEN** the Options page loads a configuration without saved per-type pause state
- **THEN** both AI task cards SHALL show paused
- **AND** the archive card SHALL show archiving disabled

#### Scenario: Maintenance actions stay reachable
- **WHEN** an AI task card renders its maintenance actions
- **THEN** retry-failed SHALL remain directly visible
- **AND** clear-queue and full-rescan SHALL remain reachable from a single overflow menu
- **AND** both destructive actions SHALL keep their confirmation dialogs

## ADDED Requirements

### Requirement: Advanced settings disclosure

The Settings section SHALL separate routine settings from advanced and diagnostic controls.

#### Scenario: Routine settings are expanded
- **WHEN** the user opens the Settings section
- **THEN** appearance, Ollama model/endpoint/language/chat concurrency, and the primary video-capture controls SHALL be visible without expanding anything

#### Scenario: Advanced controls are collapsed
- **WHEN** the Settings section renders
- **THEN** service status, media index maintenance, workspace path, enabled video formats, default capture mode, per-host overrides, and gap filling SHALL be grouped under a collapsed "高级与诊断" section

#### Scenario: All controls remain reachable
- **WHEN** the user expands the "高级与诊断" section
- **THEN** every previously available control SHALL be visible
- **AND** each setting SHALL keep its existing persistence and feedback behavior

#### Scenario: Workspace path stays discoverable
- **WHEN** the Settings section renders
- **THEN** the current workspace path SHALL be visible as a read-only summary even while the advanced section is collapsed
- **AND** changing the path SHALL remain available through the advanced section
