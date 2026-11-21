## REMOVED Requirements

### Requirement: Classification controls section

**Reason**: Replaced by independent per-task run/pause and concurrency controls; a single AI-wide control no longer matches the scheduler.

**Migration**: `classifyPaused`, `renamePaused`, `classifyConcurrency`, and `renameConcurrency` are exposed in the corresponding task cards. Legacy global concurrency is migrated to `ollamaMaxConcurrency`.

## MODIFIED Requirements

### Requirement: Service status settings section

The Options page SHALL show VFS connectivity and runtime status for the active local service.
Ollama availability SHALL be shown in the dedicated Ollama card instead of the service status card.

#### Scenario: Show VFS status
- **WHEN** the Options page displays service status
- **THEN** it SHALL show whether the VFS WebSocket service is connected

#### Scenario: Move Ollama status to the Ollama card
- **WHEN** the Options page displays service status
- **THEN** the service status card SHALL NOT duplicate the Ollama availability indicator
- **AND** the Ollama card SHALL show whether the configured Ollama endpoint is available

#### Scenario: Refresh service status
- **WHEN** the user requests a service status refresh
- **THEN** the Options page SHALL request fresh status from the Background service worker
- **AND** it SHALL update the displayed status indicators

### Requirement: Ollama settings section

The Options page SHALL provide a dedicated Ollama card for the active classifier, containing availability, endpoint, model, output language, and chat request concurrency controls.

#### Scenario: Edit Ollama endpoint
- **WHEN** the user changes the Ollama endpoint
- **THEN** the system SHALL persist the endpoint to app configuration
- **AND** future Ollama health checks and classification requests SHALL use the configured endpoint

#### Scenario: Select Ollama model
- **WHEN** the user selects a model from the model selector
- **THEN** the system SHALL immediately persist the selected model to app configuration
- **AND** subsequent classification requests SHALL use the selected model

#### Scenario: Refresh model list
- **WHEN** the user refreshes the model list
- **THEN** the Options page SHALL display installed models returned from the configured Ollama endpoint via the app
- **AND** refreshing the list SHALL NOT change the saved selected model

#### Scenario: Check Ollama availability
- **WHEN** the user triggers an Ollama health check from the Ollama card
- **THEN** the page SHALL show the current available or unavailable state
- **AND** it SHALL NOT navigate away from the card

### Requirement: Queue maintenance section

The Options page SHALL provide queue visibility and maintenance actions scoped to each AI task type.

#### Scenario: Show queue counts
- **WHEN** the Options page displays queue status
- **THEN** it SHALL show counts for pending, processing, failed, and completed tasks for each task type when those counts are available

#### Scenario: Retry failed tasks per type
- **WHEN** the user triggers retry failed tasks in an AI task card
- **THEN** the system SHALL retry failed tasks of that type
- **AND** it SHALL NOT reset failed tasks of other types
- **AND** the Options page SHALL refresh queue status after the action

#### Scenario: Clear queue per type with confirmation
- **WHEN** the user triggers clear queue in an AI task card
- **THEN** the UI SHALL require confirmation before clearing queued tasks of that type
- **AND** it SHALL NOT clear tasks of other types
- **AND** the Options page SHALL refresh queue status after the action completes

#### Scenario: Full rescan per type
- **WHEN** the user triggers a full rescan in an AI task card
- **THEN** the Options page SHALL require confirmation
- **AND** it SHALL requeue media only for that task type

### Requirement: Live queue updates

The Options page SHALL update queue counts and per-task-type scheduler state from Background events without requiring a manual refresh.

#### Scenario: Update on queue event
- **WHEN** Background broadcasts a `queue:updated` or `*:scheduler` event
- **THEN** the Options page SHALL update the displayed queue counts and per-task-type scheduler state

#### Scenario: Update on task events
- **WHEN** Background broadcasts a `task:*` event
- **THEN** the Options page SHALL update the affected task type's progress without a manual refresh

### Requirement: Console section grouping of configuration sections

The Options page SHALL group its existing configuration and management sections under the console navigation.

#### Scenario: Tags section hosts tag governance
- **WHEN** the user opens the Tags section
- **THEN** the page SHALL show the AI tag vocabulary, system tags, and tag governance actions
- **AND** renaming, merging, deleting, and pinning tags SHALL keep their existing behavior

#### Scenario: Tasks section hosts independent task cards
- **WHEN** the user opens the Tasks section
- **THEN** the page SHALL show separate AI 分类 and AI 重命名 cards with their own run/pause switch, concurrency control, and queue progress
- **AND** each of those cards SHALL include its editable prompt template and restore-default action
- **AND** each card SHALL include retry failed, full rescan, and clear-queue actions scoped to that type
- **AND** the page SHALL NOT show a shared scheduler card with a global start/pause or global concurrency control
- **AND** the media archive card SHALL provide its own enabled switch, concurrency control, and manual run action

#### Scenario: Settings section hosts program configuration
- **WHEN** the user opens the Settings section
- **THEN** the page SHALL show VFS service status, video capture settings, the dedicated Ollama card, media index maintenance, and theme controls
- **AND** the Ollama card SHALL contain Ollama availability, endpoint, vision model, output language, and chat concurrency controls
- **AND** each existing setting SHALL keep its current persistence and feedback behavior

#### Scenario: Existing configuration behavior is preserved
- **WHEN** a configuration action runs from its new section
- **THEN** the Options page SHALL continue to read and write configuration through the app RPC path
- **AND** it SHALL continue to report save failures without presenting them as successful

### Requirement: Media archive task card

The Options Tasks section SHALL provide a media archive card that configures the archive, its concurrency, and shows overall archive progress through app RPC.

#### Scenario: Show current archive state
- **WHEN** the Options Tasks section renders and the app is connected
- **THEN** it SHALL show whether archiving is enabled
- **AND** it SHALL show the configured target path, interval, and archive concurrency
- **AND** it SHALL show the last run time, pending task count, failed task count, and last error when present

#### Scenario: Show overall progress
- **WHEN** archive tasks exist in the queue
- **THEN** the card SHALL show the completed/total task count
- **AND** it SHALL render a progress bar with the completion percentage
- **AND** it SHALL show processing, pending, and failed counts when non-zero
- **AND** it SHALL update from `queue:updated` events

#### Scenario: Task console avoids duplicate archive card
- **WHEN** the task console builds its per-type cards
- **THEN** it SHALL NOT render an archive type card, because the dedicated media archive card shows aggregate archive progress

#### Scenario: Enable and save
- **WHEN** the user enables archiving, enters an absolute target directory, and saves
- **THEN** the Options page SHALL send `updateMediaArchiveConfig` through the Background relay
- **AND** on success it SHALL reflect the saved values

#### Scenario: Show validation failure
- **WHEN** the app rejects the target path
- **THEN** the Options page SHALL display the returned reason
- **AND** it SHALL NOT present the rejected configuration as saved

#### Scenario: Explain only-new semantics
- **WHEN** the media archive card renders
- **THEN** it SHALL state that only media captured after the first enable is archived
- **AND** it SHALL state that files are stored as content-hash names without metadata
- **AND** it SHALL state that each file runs as an archive task counted in the overall progress

#### Scenario: Manual trigger
- **WHEN** the user clicks the manual archive action
- **THEN** the Options page SHALL send `runMediaArchiveNow`
- **AND** it SHALL disable the action while the worker reports `running = true`
- **AND** it SHALL update the displayed status from the response without waiting for copies to finish

#### Scenario: Live status updates
- **WHEN** the app broadcasts `media-archive:status` or `queue:updated`
- **THEN** the media archive card SHALL update its displayed status and progress without a full page reload

#### Scenario: Configure archive concurrency
- **WHEN** the user changes the archive concurrency and saves
- **THEN** the Options page SHALL persist the value through `updateMediaArchiveConfig`
- **AND** the card SHALL display the saved value
- **AND** an invalid value SHALL be rejected or clamped with visible feedback

## ADDED Requirements

### Requirement: Per-task controls section

The Options page SHALL provide independent run/pause and concurrency controls for each task type.

#### Scenario: Show AI task controls
- **WHEN** the Options page renders the AI task cards
- **THEN** the AI 分类 card SHALL show its own run/pause switch and concurrency input
- **AND** the AI 重命名 card SHALL show its own run/pause switch and concurrency input

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

### Requirement: Ollama chat concurrency control

The Ollama card SHALL provide a control for `ollamaMaxConcurrency` and SHALL explain that it applies only to chat requests.

#### Scenario: Show chat concurrency default
- **WHEN** the Options page renders the Ollama card
- **THEN** it SHALL show the configured chat concurrency with a default of `1`

#### Scenario: Save chat concurrency
- **WHEN** the user changes the chat concurrency
- **THEN** the system SHALL persist the value through app RPC
- **AND** the AI client SHALL apply the new capacity without a restart

#### Scenario: Explain chat-only scope
- **WHEN** the Ollama card displays the chat concurrency control
- **THEN** it SHALL state that the limit applies only to `/api/chat`
- **AND** it SHALL state that health checks and model listings are not limited

#### Scenario: Reject invalid chat concurrency
- **WHEN** the user enters a value outside `1–8`
- **THEN** the UI SHALL prevent saving or show a validation message
- **AND** it SHALL NOT present the invalid value as successfully saved
