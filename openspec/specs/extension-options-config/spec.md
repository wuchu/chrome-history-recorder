# Extension Options Config

## Purpose

Provide a dedicated extension Options console as the source of truth for active Extension Background and VFS runtime configuration, organized into Overview, Media Library, Tags, Tasks, and Settings sections.
## Requirements
### Requirement: Dedicated extension options page
The extension SHALL provide a dedicated Options page for active program configuration.

#### Scenario: Open extension options
- **WHEN** the user opens the extension Options page
- **THEN** the system SHALL render a configuration UI for the active Extension Background + VFS runtime
- **AND** the UI SHALL be available as the extension options entrypoint

#### Scenario: Use Ant Design components
- **WHEN** the Options page renders configuration controls or feedback
- **THEN** the UI SHALL use Ant Design components for forms, cards, buttons, selectors, switches, status indicators, feedback messages, and confirmation dialogs
- **AND** extension UI code SHALL NOT use native `window.alert` or `alert` for user-facing feedback

### Requirement: Options page config source of truth
The Options page SHALL read and update active program configuration through the app, which is the source of truth.

#### Scenario: Load current configuration
- **WHEN** the Options page initializes
- **THEN** it SHALL request the current configuration from the app via the Background relay
- **AND** it SHALL populate controls from the returned values

#### Scenario: Persist configuration update
- **WHEN** the user changes a supported setting
- **THEN** the Options page SHALL persist the change through app RPC
- **AND** the app SHALL apply the changed setting to active runtime components

#### Scenario: Report save failure
- **WHEN** a configuration update fails
- **THEN** the Options page SHALL show an error message
- **AND** it SHALL NOT silently present the failed value as successfully saved

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

### Requirement: AI prompt template editors
The Options page SHALL provide editable AI prompt templates in the AI task cards.

#### Scenario: Show editable templates
- **WHEN** the Options page renders the AI task cards
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

### Requirement: Per-type queue breakdown
The Options page SHALL show AI task queue counts broken down by task type.

#### Scenario: Show classify and rename counts
- **WHEN** the Options page displays queue status
- **THEN** it SHALL show pending, processing, completed, and failed counts separately for `classify` and `rename`

### Requirement: Media index sync action
The Options page SHALL provide a manual action for synchronizing the current VFS workspace `blobs/` directory into the VFS metadata index.

#### Scenario: Trigger blob index sync
- **WHEN** the user triggers the media index sync action from the Options page
- **THEN** the Options page SHALL send a Background runtime message requesting blob index sync
- **AND** the UI SHALL show an in-progress state until the action completes or fails

#### Scenario: Show sync success summary
- **WHEN** the blob index sync action completes successfully
- **THEN** the Options page SHALL show feedback containing the number of newly indexed blobs and skipped existing blobs
- **AND** it SHALL refresh relevant service or queue-visible data when applicable

#### Scenario: Show sync failure
- **WHEN** the blob index sync action fails
- **THEN** the Options page SHALL show an error message
- **AND** it SHALL clear the in-progress state

### Requirement: Media index sync action
The Options page SHALL provide a manual action for synchronizing the current VFS workspace `blobs/` directory into the VFS metadata index.

#### Scenario: Trigger blob index sync
- **WHEN** the user triggers the media index sync action from the Options page
- **THEN** the Options page SHALL send a Background runtime message requesting blob index sync
- **AND** the UI SHALL show an in-progress state until the action completes or fails

#### Scenario: Show sync success summary
- **WHEN** the blob index sync action completes successfully
- **THEN** the Options page SHALL show feedback containing the number of newly indexed blobs and skipped existing blobs
- **AND** it SHALL refresh relevant service or queue-visible data when applicable

#### Scenario: Show sync failure
- **WHEN** the blob index sync action fails
- **THEN** the Options page SHALL show an error message
- **AND** it SHALL clear the in-progress state

### Requirement: Video capture settings section

The Options page SHALL provide a video capture settings section for the active capture runtime.

#### Scenario: Toggle video capture
- **WHEN** the user enables or disables video capture
- **THEN** the system persists the setting to extension configuration
- **AND** the active capture runtime immediately starts or stops treating video responses as download candidates

#### Scenario: Configure maximum video size
- **WHEN** the user sets a maximum video size
- **THEN** the system persists the value to extension configuration
- **AND** video candidates larger than the new value are skipped

#### Scenario: Select enabled video formats
- **WHEN** the user selects the video formats to capture
- **THEN** the system persists the selected MIME types to extension configuration
- **AND** the active capture runtime only records candidates matching the selected formats

#### Scenario: Select default capture mode
- **WHEN** the user selects `re-download` or `buffer-only` as the default video capture mode
- **THEN** the system persists the value to extension configuration
- **AND** pages without a host override use the new mode

#### Scenario: Configure per-host capture mode overrides
- **WHEN** the user edits the host override list in the form `host=mode`
- **THEN** the system persists the normalized host suffixes and modes to extension configuration
- **AND** invalid hosts or modes are rejected with a visible error

#### Scenario: Toggle optional gap filling
- **WHEN** the user enables or disables "补齐缺失区间"
- **THEN** the system persists `videoAssemblyFillGaps` to extension configuration
- **AND** the section explains that it issues additional Range requests for missing bytes
- **AND** the default is enabled and the user can turn it off

#### Scenario: Reject invalid maximum size
- **WHEN** the user enters a maximum video size outside the supported range or not a number
- **THEN** the Options page shows a validation error
- **AND** the invalid value is not persisted

#### Scenario: Default video settings
- **WHEN** the Options page loads with no saved video settings
- **THEN** it displays video capture enabled, a maximum size of 200 MiB, MP4 and WebM selected, the global `re-download` mode, and gap filling enabled

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

### Requirement: Workspace storage settings section

The Options Settings section SHALL provide a workspace storage card that shows and edits the VFS workspace path through app RPC.

#### Scenario: Show current workspace state
- **WHEN** the Options Settings section renders and the app is connected
- **THEN** it SHALL show the current workspace path
- **AND** it SHALL show the resolution source as one of CLI argument, environment variable, launcher configuration, or default
- **AND** it SHALL show the default workspace path

#### Scenario: Show pending path and restart requirement
- **WHEN** the app reports a `pendingPath` different from the current path
- **THEN** the card SHALL show the pending path
- **AND** it SHALL state that the running backend still writes to the current path and that a backend restart is required

#### Scenario: Save a new workspace path
- **WHEN** the user enters an absolute path and saves
- **THEN** the Options page SHALL send `setWorkspacePath` through the Background relay
- **AND** on success it SHALL show a success message stating that a backend restart is required
- **AND** it SHALL refresh the displayed pending path

#### Scenario: Show validation failure
- **WHEN** the app rejects a workspace path
- **THEN** the Options page SHALL display the returned reason
- **AND** it SHALL NOT present the rejected path as saved or pending

#### Scenario: Read-only under startup override
- **WHEN** the app reports the workspace source as CLI argument or environment variable
- **THEN** the card SHALL disable editing and saving
- **AND** it SHALL explain that the startup argument or environment variable takes precedence

#### Scenario: Warn when switching to a new workspace
- **WHEN** the user saves a path that will initialize a new empty workspace
- **THEN** the UI SHALL warn that application configuration returns to defaults, including paused classification
- **AND** it SHALL state that the previous workspace and its configuration remain in place
- **AND** it SHALL require explicit confirmation before sending the update

#### Scenario: Copy the current path
- **WHEN** the user requests to copy the current workspace path
- **THEN** the Options page SHALL copy the absolute path to the clipboard
- **AND** it SHALL provide feedback that the path was copied

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
