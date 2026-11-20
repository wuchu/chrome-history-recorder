## ADDED Requirements

### Requirement: Console tab grouping of configuration sections
The Options page SHALL group its existing configuration and management sections under the console tabs.

#### Scenario: Tags tab hosts tag governance
- **WHEN** the user opens the Tags tab
- **THEN** the page SHALL show the AI tag vocabulary, system tags, and tag governance actions
- **AND** renaming, merging, deleting, and pinning tags SHALL keep their existing behavior

#### Scenario: Tasks tab hosts the AI task console
- **WHEN** the user opens the Tasks tab
- **THEN** the page SHALL show the unified AI task console
- **AND** scheduler start and pause, per-type counts, retry failed, clear queue, rescan, and concurrency controls SHALL keep their existing behavior

#### Scenario: Settings tab hosts program configuration
- **WHEN** the user opens the Settings tab
- **THEN** the page SHALL show the service status, video capture settings, Ollama settings, media index maintenance, AI prompt templates, and theme controls
- **AND** each existing setting SHALL keep its current persistence and feedback behavior

#### Scenario: Existing configuration behavior is preserved
- **WHEN** a configuration action runs from its new tab
- **THEN** the Options page SHALL continue to read and write configuration through the app RPC path
- **AND** it SHALL continue to report save failures without presenting them as successful
