# Spec: App Config Store

## Purpose

Own runtime configuration in the app process and expose it to the extension through RPC and mirrored capture settings.

## Requirements

### Requirement: App owns configuration

The app SHALL be the source of truth for runtime configuration, persisted in the workspace.

#### Scenario: Persist configuration
- **WHEN** configuration changes
- **THEN** the app SHALL persist the new values to the workspace and apply them to the scheduler, AI client, and transport

#### Scenario: Load configuration on startup
- **WHEN** the app starts
- **THEN** the app SHALL load persisted configuration or fall back to defaults when none exists

### Requirement: One-time migration from chrome.storage

The app SHALL accept a one-time configuration hand-off from the extension's `chrome.storage.local`.

#### Scenario: Successful migration
- **WHEN** the extension presents a stored `vfsConfig`
- **THEN** the app SHALL persist the migrated values and stop relying on `chrome.storage.local`

#### Scenario: Migration failure
- **WHEN** the migration request is malformed or fails
- **THEN** the app SHALL keep its existing or default configuration
- **AND** the failure SHALL be reported to the extension

### Requirement: Extension config mirror

The app SHALL push capture-relevant configuration to the extension and refresh it on connect and on change.

#### Scenario: Mirror on connect
- **WHEN** the extension connects
- **THEN** the app SHALL send the current capture settings so the extension can capture without a separate source of truth

#### Scenario: Mirror on change
- **WHEN** capture settings change in the app
- **THEN** the app SHALL push the updated settings to the connected extension

### Requirement: Options reads and writes through the app

The options page SHALL read and write configuration through app RPC rather than `chrome.storage.local`.

#### Scenario: Read configuration
- **WHEN** the options page loads
- **THEN** it SHALL request the current configuration from the app

#### Scenario: Write configuration
- **WHEN** the user changes a setting
- **THEN** the options page SHALL persist the change through app RPC and display a failure if the app rejects it

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

### Requirement: Ollama chat concurrency configuration

The app configuration SHALL include `ollamaMaxConcurrency`, an integer that caps concurrent `POST /api/chat` requests, with a default of `1` and a supported range of `1–8`.

#### Scenario: Default chat concurrency
- **WHEN** the persisted configuration does not contain `ollamaMaxConcurrency`
- **THEN** the app SHALL load it as `1`
- **AND** the AI client SHALL allow at most one chat request at a time

#### Scenario: Clamp chat concurrency
- **WHEN** a persisted or updated value is below `1`, above `8`, or not an integer
- **THEN** the app SHALL clamp or floor it into the `1–8` range
- **AND** it SHALL persist the normalized value on the next update

#### Scenario: Apply chat concurrency
- **WHEN** the user changes `ollamaMaxConcurrency`
- **THEN** the app SHALL apply the new capacity to the AI client without restarting the process
- **AND** it SHALL NOT cancel requests already in flight

### Requirement: Per-task concurrency and pause configuration

The app configuration SHALL include independent concurrency and pause fields for `classify`, `rename`, and `archive`.
The concurrency fields SHALL be `classifyConcurrency`, `renameConcurrency`, and `mediaArchiveConcurrency`, each defaulting to `1` and supporting the range `1–8`.
The pause fields SHALL be `classifyPaused` and `renamePaused`, each defaulting to `true`.

#### Scenario: Default per-task settings
- **WHEN** the persisted configuration does not contain the per-task fields
- **THEN** the app SHALL load every concurrency field as `1`
- **AND** it SHALL load `classifyPaused` and `renamePaused` as `true`

#### Scenario: Clamp per-task concurrency
- **WHEN** a persisted or updated per-task concurrency is below `1`, above `8`, or not an integer
- **THEN** the app SHALL clamp or floor it into the `1–8` range

#### Scenario: Persist independent pause states
- **WHEN** the user pauses or resumes one task type
- **THEN** the app SHALL persist only that type's pause field
- **AND** the pause fields of other task types SHALL remain unchanged

#### Scenario: Expose per-task settings to the extension
- **WHEN** the extension calls `getConfig`
- **THEN** the response SHALL include all per-task concurrency and pause fields
- **AND** the extension mirror SHALL use the same field names and defaults

### Requirement: Legacy scheduling configuration migration

The app SHALL migrate the legacy global scheduling fields without losing user intent.

#### Scenario: Migrate legacy concurrency
- **WHEN** the persisted or imported configuration contains `classificationConcurrency` and does not contain `ollamaMaxConcurrency`
- **THEN** the app SHALL use the legacy value as `ollamaMaxConcurrency`
- **AND** it SHALL keep every per-task concurrency at its default unless separately provided

#### Scenario: Migrate legacy pause state
- **WHEN** the persisted or imported configuration contains `classificationPaused` and does not contain `classifyPaused` or `renamePaused`
- **THEN** the app SHALL use the legacy value for both `classifyPaused` and `renamePaused`

#### Scenario: New fields take precedence
- **WHEN** the configuration contains both a new field and its legacy counterpart
- **THEN** the app SHALL use the new field value
- **AND** the legacy value SHALL be ignored

#### Scenario: Drop legacy keys after migration
- **WHEN** the app persists a migrated configuration
- **THEN** the persisted JSON SHALL contain the new fields
- **AND** it SHALL NOT contain `classificationConcurrency` or `classificationPaused`

#### Scenario: Migrate before merging defaults
- **WHEN** legacy configuration sets `classificationPaused` to `false` and the new pause fields are absent
- **THEN** the app SHALL migrate the value before applying default values
- **AND** both `classifyPaused` and `renamePaused` SHALL become `false`
