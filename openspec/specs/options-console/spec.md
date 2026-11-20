# Options Console

## Purpose

Provide the tabbed Options console for global overview, media library, tags, tasks, and settings.

## Requirements

### Requirement: Tabbed console navigation
The Options page SHALL present its content through five top-level tabs: Overview (概览), Media Library (媒体库), Tags (标签), Tasks (任务), and Settings (设置).

#### Scenario: Render all console tabs
- **WHEN** the user opens the Options page
- **THEN** the page SHALL render the five top-level tabs
- **AND** the Overview tab SHALL be active by default

#### Scenario: Switch tabs without a page reload
- **WHEN** the user selects a different console tab
- **THEN** the page SHALL show that tab's content without a full document reload

#### Scenario: Deep link to a tab
- **WHEN** the Options page is opened with a supported tab identifier in its URL
- **THEN** the page SHALL activate that tab
- **AND** an unsupported or missing identifier SHALL fall back to the Overview tab

#### Scenario: Preserve the active tab across reload
- **WHEN** the user reloads the Options page while a non-default tab is active
- **THEN** the page SHALL restore the same active tab

### Requirement: Overview tab
The Options Overview tab SHALL summarize the global state of the recorder without becoming a capture control surface.

#### Scenario: Show service status
- **WHEN** the Overview tab renders
- **THEN** it SHALL show VFS connectivity and Ollama availability

#### Scenario: Show storage and media summary
- **WHEN** the Overview tab renders
- **THEN** it SHALL show total media count, total storage size, image count, video count, and uncategorized count when available

#### Scenario: Show AI queue summary
- **WHEN** the Overview tab renders
- **THEN** it SHALL show a snapshot of the AI task queue including pending, processing, completed, and failed counts

#### Scenario: Show recent captures
- **WHEN** the Overview tab renders
- **THEN** it SHALL show a bounded list of the most recently captured media
- **AND** each recent item SHALL link to the Media Library or open its media detail

#### Scenario: Show the active capture session read-only
- **WHEN** a capture session is active
- **THEN** the Overview tab SHALL show the session tab, current page, and session saved count
- **AND** it SHALL NOT provide controls to start, stop, or switch the capture session

### Requirement: Media Library tab availability
The Options page SHALL include a Media Library tab that hosts the global media library capability.

#### Scenario: Open the library from the tab
- **WHEN** the user selects the Media Library tab
- **THEN** the page SHALL render the global media library defined by the `options-media-library` capability

#### Scenario: Library tab contains no capture controls
- **WHEN** the Media Library tab renders
- **THEN** it SHALL NOT provide controls to start or stop a capture session

### Requirement: Console handoff from the Side Panel
The Options page SHALL accept navigation from the Side Panel to a specific console tab.

#### Scenario: Open the Media Library from the Side Panel
- **WHEN** the Side Panel requests the Media Library
- **THEN** the Options page SHALL open with the Media Library tab active
- **AND** the library SHALL show the global media list without a session-specific filter

#### Scenario: Open Settings from the Side Panel
- **WHEN** the Side Panel requests settings
- **THEN** the Options page SHALL open with the Settings tab active

#### Scenario: Invalid handoff target
- **WHEN** the requested console tab is not recognized
- **THEN** the Options page SHALL open on the Overview tab
