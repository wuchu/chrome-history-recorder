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
