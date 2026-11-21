## ADDED Requirements

### Requirement: Unprocessable media is skipped, not retried

The rename task SHALL share the AI media eligibility decision with classification. Ineligible media and permanent unprocessable-media failures SHALL produce a skipped outcome without consuming retry attempts.

#### Scenario: Ineligible media is never sent to the model
- **WHEN** a `rename` task is created for media that is ineligible for AI vision processing
- **THEN** the task SHALL be recorded as `skipped` with the eligibility reason
- **AND** the system SHALL NOT obtain a representative image or call Ollama for it

#### Scenario: Permanent runtime failure skips once
- **WHEN** a `rename` task runs for eligible media but no representative image can be produced
- **THEN** the task SHALL be marked `skipped` after a single attempt with the permanent reason
- **AND** it SHALL NOT be retried

#### Scenario: Transient rename failures still retry
- **WHEN** a `rename` task fails because Ollama is unavailable, the request times out, or the model returns unusable output
- **THEN** the task SHALL follow the existing retry policy

#### Scenario: Skipping rename does not affect classify
- **WHEN** a `rename` task for a hash is skipped
- **THEN** the `classify` task for that hash SHALL keep its independent status

#### Scenario: Requeue and rescan re-evaluate eligibility
- **WHEN** a skipped rename task is explicitly requeued or included in a full rescan
- **THEN** the system SHALL recompute eligibility for that media
- **AND** it SHALL become pending only if the media is now eligible
