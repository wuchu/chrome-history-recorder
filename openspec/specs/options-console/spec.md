# Options Console

## Purpose

Provide the Options console for global overview, media library, tags, tasks, and settings.

## Requirements

### Requirement: Console navigation
The Options page SHALL present its content through five top-level sections — Overview (概览), Media Library (媒体库), Tags (标签), Tasks (任务), and Settings (设置) — reachable from a collapsible icon navigation rail.

#### Scenario: Render all console sections
- **WHEN** the user opens the Options page
- **THEN** the page SHALL render the five top-level navigation items
- **AND** the navigation rail SHALL default to the collapsed state showing icons only
- **AND** the Overview section SHALL be active by default

#### Scenario: Expand the navigation
- **WHEN** the user expands the navigation rail
- **THEN** it SHALL show both icons and section labels
- **AND** collapsing it again SHALL restore the icon-only rail

#### Scenario: Switch sections without a page reload
- **WHEN** the user selects a different console section
- **THEN** the page SHALL show that section's content without a full document reload

#### Scenario: Deep link to a section
- **WHEN** the Options page is opened with a supported section identifier in its URL
- **THEN** the page SHALL activate that section
- **AND** an unsupported or missing identifier SHALL fall back to the Overview section

#### Scenario: Preserve the active section across reload
- **WHEN** the user reloads the Options page while a non-default section is active
- **THEN** the page SHALL restore the same active section

### Requirement: Overview section
The Options Overview section SHALL summarize the global state of the recorder without becoming a capture control surface.

#### Scenario: Show service status
- **WHEN** the Overview section renders
- **THEN** it SHALL show VFS connectivity and Ollama availability

#### Scenario: Show storage and media summary
- **WHEN** the Overview section renders
- **THEN** it SHALL show total media count, total storage size, image count, video count, and uncategorized count when available

#### Scenario: Show AI queue summary
- **WHEN** the Overview section renders
- **THEN** it SHALL show a snapshot of the AI task queue including pending, processing, completed, failed, and skipped counts

#### Scenario: Show recent captures
- **WHEN** the Overview section renders
- **THEN** it SHALL show a bounded list of the most recently captured media
- **AND** each recent item SHALL link to the Media Library or open its media detail

#### Scenario: Show the active capture session read-only
- **WHEN** a capture session is active
- **THEN** the Overview section SHALL show the session tab, current page, and session saved count
- **AND** it SHALL NOT provide controls to start, stop, or switch the capture session

### Requirement: Media Library section availability
The Options page SHALL include a Media Library section that hosts the global media library capability.

#### Scenario: Open the library from the navigation
- **WHEN** the user selects the Media Library section
- **THEN** the page SHALL render the global media library defined by the `options-media-library` capability

#### Scenario: Library section contains no capture controls
- **WHEN** the Media Library section renders
- **THEN** it SHALL NOT provide controls to start or stop a capture session

### Requirement: Console handoff from the Side Panel
The Options page SHALL accept navigation from the Side Panel to a specific console section.

#### Scenario: Open the Media Library from the Side Panel
- **WHEN** the Side Panel requests the Media Library
- **THEN** the Options page SHALL open with the Media Library section active
- **AND** the library SHALL show the global media list without a session-specific filter

#### Scenario: Open Settings from the Side Panel
- **WHEN** the Side Panel requests settings
- **THEN** the Options page SHALL open with the Settings section active

#### Scenario: Invalid handoff target
- **WHEN** the requested console section is not recognized
- **THEN** the Options page SHALL open on the Overview section
