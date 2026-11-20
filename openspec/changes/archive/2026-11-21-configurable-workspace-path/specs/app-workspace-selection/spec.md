## ADDED Requirements

### Requirement: Workspace path resolution order

The app SHALL resolve its workspace path in a fixed precedence order and SHALL report which source produced the resolved path.

The precedence order is: `--workspace` / `-w`, then `VFS_WORKSPACE`, then the user-level launcher configuration, then the default `~/.vfs-workspace`.

#### Scenario: No custom configuration
- **WHEN** the app starts without `--workspace` / `-w`, without `VFS_WORKSPACE`, and without a launcher configuration
- **THEN** the app SHALL use `~/.vfs-workspace`
- **AND** it SHALL report the source as `default`

#### Scenario: Launcher configuration supplies the path
- **WHEN** the app starts without `--workspace` / `-w` and without `VFS_WORKSPACE`, and the launcher configuration contains `workspacePath`
- **THEN** the app SHALL use the configured absolute path
- **AND** it SHALL report the source as `config`

#### Scenario: CLI argument overrides launcher configuration
- **WHEN** the app starts with `--workspace /cli/path` and the launcher configuration contains a different path
- **THEN** the app SHALL use `/cli/path`
- **AND** it SHALL report the source as `cli`
- **AND** it SHALL leave the launcher configuration unchanged

#### Scenario: Environment variable overrides launcher configuration
- **WHEN** the app starts with `VFS_WORKSPACE=/env/path`, no CLI argument, and a launcher configuration with a different path
- **THEN** the app SHALL use `/env/path`
- **AND** it SHALL report the source as `env`

#### Scenario: Leading tilde is expanded
- **WHEN** a CLI argument, environment value, or launcher configuration value begins with `~`
- **THEN** the app SHALL expand it to the user's home directory before use

### Requirement: Launcher configuration persistence

The app SHALL persist a custom workspace path in a user-level launcher configuration file located outside any workspace.

#### Scenario: Platform-specific location
- **WHEN** the app reads or writes the launcher configuration
- **THEN** on macOS it SHALL use `~/Library/Application Support/browser-media-recorder/config.json`
- **AND** on Linux it SHALL use `$XDG_CONFIG_HOME/browser-media-recorder/config.json`, defaulting to `~/.config/browser-media-recorder/config.json`
- **AND** on Windows it SHALL use `%APPDATA%\browser-media-recorder\config.json`

#### Scenario: Configuration format
- **WHEN** the app writes the launcher configuration
- **THEN** the file SHALL contain a `version` field set to `1`
- **AND** it SHALL contain the custom path in `workspacePath`
- **AND** it SHALL NOT contain AI, capture, or task configuration

#### Scenario: Atomic write
- **WHEN** the app saves a new workspace path
- **THEN** it SHALL write a temporary file and atomically replace the launcher configuration
- **AND** a crash mid-write SHALL NOT leave a partially written configuration

#### Scenario: Unreadable configuration
- **WHEN** the launcher configuration is missing, malformed, or unreadable
- **THEN** the app SHALL log a warning, treat the workspace as unconfigured, and continue with the next precedence source
- **AND** it SHALL NOT fail startup because of the configuration file

#### Scenario: Configuration does not live in the workspace
- **WHEN** the app persists the workspace path
- **THEN** it SHALL NOT write the path to `workspace/config.json`
- **AND** it SHALL NOT use extension `chrome.storage` as the source of truth for the path

### Requirement: Workspace path query API

The app SHALL expose the workspace path state through the existing `getWorkspaceConfig` RPC with resolution metadata.

#### Scenario: Return current path and metadata
- **WHEN** the extension calls `getWorkspaceConfig`
- **THEN** the app SHALL return `path`, `defaultPath`, and `source`
- **AND** `path` SHALL equal the workspace used by the running process

#### Scenario: Report a pending path
- **WHEN** the launcher configuration contains a path different from the running workspace and the source is `config` or `default`
- **THEN** the response SHALL include `pendingPath` equal to the configured path
- **AND** the response SHALL continue to report the running `path` separately

#### Scenario: No pending path under override
- **WHEN** the source is `cli` or `env`
- **THEN** the response SHALL NOT include `pendingPath`
- **AND** the launcher configuration value SHALL NOT take effect on the next restart

#### Scenario: Pending path reflects external edits
- **WHEN** the launcher configuration file is edited outside the app
- **THEN** a subsequent `getWorkspaceConfig` call SHALL reflect the new `pendingPath`
- **AND** the app SHALL NOT require a file watcher for this behavior

### Requirement: Workspace path update API

The app SHALL expose a `setWorkspacePath` RPC that validates and persists a new workspace path without changing the running workspace.

#### Scenario: Save a valid path
- **WHEN** the extension calls `setWorkspacePath` with a path that passes validation
- **THEN** the app SHALL atomically persist the path to the launcher configuration
- **AND** it SHALL return `{ success: true, restartRequired: true, pendingPath }`
- **AND** the running workspace SHALL remain unchanged

#### Scenario: Reject an invalid path
- **WHEN** the extension calls `setWorkspacePath` with a path that fails validation
- **THEN** the app SHALL return a failure with a specific reason
- **AND** it SHALL NOT modify the launcher configuration

#### Scenario: Reject updates under CLI or environment override
- **WHEN** the running app resolved its workspace from `--workspace` or `VFS_WORKSPACE`
- **THEN** `setWorkspacePath` SHALL reject the update and explain that startup configuration takes precedence

### Requirement: Workspace target validation

The app SHALL validate a candidate workspace path before saving and again before using it at startup.

#### Scenario: Require an absolute path
- **WHEN** the candidate path is relative after tilde expansion
- **THEN** validation SHALL fail with a message asking for an absolute path

#### Scenario: Reject dangerous locations
- **WHEN** the candidate path is the filesystem root, the user's home directory, the current workspace, or any path inside the current workspace
- **THEN** validation SHALL fail

#### Scenario: Require an existing writable parent
- **WHEN** the candidate path does not exist and its parent directory is missing or not writable
- **THEN** validation SHALL fail
- **AND** the app SHALL NOT recursively create missing parent directories

#### Scenario: Reject unmounted external volumes
- **WHEN** the candidate path is under `/Volumes/<name>` and `/Volumes/<name>` does not exist
- **THEN** validation SHALL fail with a message that the external volume is not mounted

#### Scenario: Reject a non-directory target
- **WHEN** the candidate path exists and is not a directory
- **THEN** validation SHALL fail

#### Scenario: Accept a new empty directory
- **WHEN** the candidate path does not exist, or exists as a directory containing only `.DS_Store`
- **THEN** validation SHALL pass
- **AND** the workspace SHALL be initialized with default configuration on the next start

#### Scenario: Accept an existing workspace
- **WHEN** the candidate directory contains `vfs.db`
- **THEN** validation SHALL pass
- **AND** the app SHALL adopt the existing workspace and its `config.json` on the next start

#### Scenario: Reject a non-empty non-workspace directory
- **WHEN** the candidate directory is non-empty, contains no `vfs.db`, and contains entries other than `.DS_Store`
- **THEN** validation SHALL fail and SHALL NOT write any workspace files into that directory

#### Scenario: Revalidate at startup
- **WHEN** the app starts with a configured workspace path
- **THEN** it SHALL repeat the validation
- **AND** a workspace that became unavailable after saving SHALL NOT be opened or replaced silently

### Requirement: Workspace change requires restart

A saved workspace path SHALL take effect only when the app process restarts.

#### Scenario: Running process keeps the old workspace
- **WHEN** a valid path is saved while the app is running
- **THEN** the app SHALL keep writing captures, metadata, and thumbnails to the current workspace
- **AND** it SHALL NOT tear down or rebuild storage, transport, or scheduler components

#### Scenario: New path applies after restart
- **WHEN** the app restarts after a path is saved
- **THEN** the new path SHALL be resolved by the precedence rules
- **AND** the app SHALL open or initialize the workspace at that path
- **AND** `pendingPath` SHALL no longer be reported

### Requirement: Workspace data is never moved or deleted

Changing the workspace path SHALL leave the previous workspace's data untouched.

#### Scenario: Previous workspace remains intact
- **WHEN** a new workspace path takes effect
- **THEN** the previous workspace's `vfs.db`, `blobs/`, `thumbnails/`, and `config.json` SHALL remain in place
- **AND** the app SHALL NOT copy, move, or delete them

#### Scenario: Workspace-scoped configuration follows the workspace
- **WHEN** the app opens an empty new workspace
- **THEN** it SHALL use default application configuration, including paused classification
- **AND** when it later opens the previous workspace, that workspace's `config.json` SHALL apply again

### Requirement: Startup fails fast when the configured workspace is unavailable

The app SHALL refuse to start when a configured workspace cannot be used, instead of falling back to another location.

#### Scenario: Configured workspace is unusable
- **WHEN** the app starts and the resolved workspace cannot be validated or opened
- **THEN** the app SHALL print the resolved path, the failure reason, the resolution source, and the launcher configuration path
- **AND** it SHALL exit with a non-zero status
- **AND** it SHALL NOT start the WebSocket or HTTP servers

#### Scenario: Recovery guidance
- **WHEN** the app exits because the configured workspace is unavailable
- **THEN** the error output SHALL describe how to recover by making the path available, using `--workspace` to override, or removing the path from the launcher configuration to return to the default

#### Scenario: No automatic fallback
- **WHEN** a configured workspace is unavailable
- **THEN** the app SHALL NOT fall back to `~/.vfs-workspace` or to a previously used workspace

#### Scenario: Default workspace is created normally
- **WHEN** the resolved source is `default` and the default directory does not exist
- **THEN** the app SHALL create the default workspace and start normally
