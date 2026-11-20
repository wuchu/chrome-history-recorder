## MODIFIED Requirements

### Requirement: VFS Service manages workspace configuration

The VFS Service SHALL resolve its workspace path from command-line arguments first, then the `VFS_WORKSPACE` environment variable, then the default location `~/.vfs-workspace`.

#### Scenario: Initialize default workspace
- **WHEN** VFS Service starts without `--workspace` / `-w` and without `VFS_WORKSPACE` set
- **THEN** VFS Service uses `~/.vfs-workspace` as the workspace path
- **AND** creates the directory structure if it does not exist

#### Scenario: Initialize custom workspace from CLI
- **WHEN** VFS Service starts with `--workspace /custom/path` or `-w /custom/path`
- **THEN** VFS Service uses `/custom/path` as the workspace path
- **AND** expands a leading `~` to the user's home directory

#### Scenario: Initialize custom workspace from environment
- **WHEN** VFS Service starts with `VFS_WORKSPACE=/custom/path` and no `--workspace` / `-w` argument
- **THEN** VFS Service uses `/custom/path` as the workspace path

#### Scenario: CLI overrides environment
- **WHEN** VFS Service starts with both `--workspace /cli/path` and `VFS_WORKSPACE=/env/path`
- **THEN** VFS Service uses `/cli/path` as the workspace path

#### Scenario: Get workspace config
- **WHEN** Extension calls `getWorkspaceConfig`
- **THEN** VFS Service returns an object whose `path` is the resolved workspace path

#### Scenario: Workspace is immutable for the VFS Service
- **WHEN** a caller invokes `setWorkspaceConfig` on the VFS Service
- **THEN** VFS Service rejects the request and reports that the workspace path cannot be changed after initialization
