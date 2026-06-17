## MODIFIED Requirements

### Requirement: Side Panel service status
The Side Panel SHALL show capture, VFS, Ollama, and classification status for the active Extension Background runtime in a compact single-row layout.

#### Scenario: Show runtime service status
- **WHEN** the Side Panel renders its status area
- **THEN** it SHALL show whether VFS is connected with a status dot and the text "VFS"
- **AND** it SHALL show whether Ollama is available with a status dot and the text "Ollama"
- **AND** it SHALL show the service status with a status dot and the text "服务"
- **AND** it SHALL show capture success count as ✅N and failure count as ❌N
- **AND** VFS and Ollama connection indicators SHALL use consistently sized status dots
- **AND** it SHALL show whether capture is active for the current tab
- **AND** status information SHALL be grouped with vertical bar separators for visual clarity

#### Scenario: Status updates from Background events
- **WHEN** Background broadcasts service or scheduler status events
- **THEN** the Side Panel SHALL update the visible status without requiring a page refresh

#### Scenario: Show capture error as tooltip
- **WHEN** a capture error exists
- **THEN** the ❌ icon SHALL have a tooltip showing the error message
- **AND** the error text SHALL NOT be displayed inline in the status bar
