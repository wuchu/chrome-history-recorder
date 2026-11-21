## ADDED Requirements

### Requirement: One-shot capture is independent of the capture session

The capture session model SHALL remain limited to continuous CDP capture, and user-initiated one-shot saves SHALL operate outside it.

#### Scenario: No session created
- **WHEN** the user saves one image or runs a page scan
- **THEN** the system SHALL NOT create a capture session
- **AND** the session status SHALL remain unchanged

#### Scenario: Existing session remains active
- **WHEN** a session is active for tab A and the user performs a one-shot save or scan on tab B
- **THEN** the tab A session SHALL remain active
- **AND** its counters, event log, and start time SHALL remain unchanged

#### Scenario: No debugger attach
- **WHEN** a one-shot save runs
- **THEN** the system SHALL NOT attach or detach the debugger for that tab

#### Scenario: Library visibility
- **WHEN** a one-shot save creates a new library item
- **THEN** the item SHALL be visible through the global media library and `file:captured`
- **AND** it SHALL NOT be added to the session feed or session summary
