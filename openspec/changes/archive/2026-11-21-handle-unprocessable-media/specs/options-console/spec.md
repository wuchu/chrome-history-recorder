## MODIFIED Requirements

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
