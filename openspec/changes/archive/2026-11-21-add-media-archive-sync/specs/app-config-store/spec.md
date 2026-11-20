## ADDED Requirements

### Requirement: Media archive configuration

The app SHALL persist media archive settings as part of its runtime configuration and SHALL apply safe defaults when they are missing or invalid.

The settings are `mediaArchiveEnabled` (boolean, default `false`), `mediaArchiveTargetPath` (string, default empty), and `mediaArchiveIntervalMinutes` (integer, default `5`).

#### Scenario: Load legacy configuration
- **WHEN** the persisted configuration does not contain any media archive fields
- **THEN** the app SHALL load them with their default values
- **AND** it SHALL NOT fail to start

#### Scenario: Normalize interval
- **WHEN** the persisted or updated interval is below 1 or above 1440
- **THEN** the app SHALL clamp it into the 1–1440 range

#### Scenario: Trim target path
- **WHEN** a target path is saved with surrounding whitespace
- **THEN** the app SHALL persist the trimmed value

#### Scenario: Expose settings to the extension
- **WHEN** the extension calls `getConfig`
- **THEN** the response SHALL include the three media archive fields

#### Scenario: Reject enabling without a valid target
- **WHEN** the user enables the archive without a target path or with an invalid target
- **THEN** the app SHALL reject the update
- **AND** it SHALL NOT persist `mediaArchiveEnabled = true`
