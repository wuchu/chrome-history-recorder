## MODIFIED Requirements

### Requirement: DevTools exposes queue maintenance actions
The extension SHALL expose queue maintenance actions for failed and queued AI tasks from the Options page, routed to the app.

#### Scenario: Retry failed tasks
- **WHEN** the user clicks retry failed tasks
- **THEN** the Options page SHALL request the app to retry failed queue entries
- **AND** the app SHALL reset failed tasks for eligible media to pending
- **AND** failed tasks for ineligible media SHALL become skipped instead of pending
- **AND** queue status SHALL refresh after the operation
- **AND** the interface SHALL expose the skipped count and reasons

#### Scenario: Clear classification queue
- **WHEN** the user clicks clear queue and confirms the action
- **THEN** the Options page SHALL request the app to clear the task queue
- **AND** queue status SHALL refresh after the operation

### Requirement: Media quick actions requeue AI processing
The extension SHALL provide quick actions that requeue a specific media item for classification and AI filename regeneration, routed to the app.

#### Scenario: Requeue media from detail view
- **WHEN** the user clicks reclassify or regenerate AI filename for an eligible media item
- **THEN** the Side Panel SHALL send that media hash through the Background relay to the app for requeue
- **AND** the app SHALL enqueue the hash for classification with elevated priority
- **AND** the media item SHALL show a pending or queued status after the operation

#### Scenario: Requeue media from grid quick action
- **WHEN** the user invokes a requeue quick action from a media card
- **THEN** the same requeue behavior SHALL apply as the detail view action

#### Scenario: Requeue ineligible media shows a reason
- **WHEN** the user requeues a media item whose format cannot be processed by the AI pipeline
- **THEN** the app SHALL return the ineligibility reason
- **AND** the interface SHALL show an actionable message explaining that the format is not supported
- **AND** the media item SHALL show a skipped status rather than a queued status

#### Scenario: Preserve user-owned metadata during reprocessing
- **WHEN** requeued AI processing completes
- **THEN** the system SHALL overwrite AI-owned fields such as `ai_filename`, `tags`, `confidence`, `classified_at`, and `model_used`
- **AND** it SHALL preserve user-owned fields such as `is_starred` and `user_notes`
