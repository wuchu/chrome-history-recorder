## ADDED Requirements

### Requirement: Active setup artifacts match supported transport
The repository SHALL only expose active setup scripts and templates for the currently supported Extension-to-VFS transport.

#### Scenario: Native Messaging setup artifacts removed
- **WHEN** developers inspect active setup scripts and VFS Service templates after this change
- **THEN** they MUST NOT find scripts or manifest templates that register `com.chromehistoryrecorder.vfs` as a Chrome Native Messaging Host

### Requirement: Active metadata describes WebSocket and HTTP service
Package metadata for the VFS Service SHALL describe the service as the current WebSocket + HTTP local service rather than as a Chrome Native Messaging Host.

#### Scenario: VFS package metadata reviewed
- **WHEN** developers inspect `packages/vfs-service/package.json`
- **THEN** the package description and keywords MUST NOT present Native Messaging as the active VFS Service transport

### Requirement: Tests validate only supported active transports
The VFS Service test suite SHALL only include tests that can run against source modules and transports supported by the current architecture.

#### Scenario: VFS tests run after cleanup
- **WHEN** developers run the VFS Service test suite with a non-watch command
- **THEN** the suite MUST NOT fail because a test imports deleted Native Messaging modules
- **AND** supported VFS API, dispatcher, WebSocket, HTTP, storage, and integration behavior MUST remain covered by runnable tests

### Requirement: Architecture documentation matches current implementation
Active architecture documentation SHALL describe the WebSocket + HTTP dual-channel architecture as the current design.

#### Scenario: Architecture documentation reviewed
- **WHEN** developers read `ARCHITECTURE.md`
- **THEN** it MUST identify WebSocket as the API/event channel and HTTP as the file/thumbnail delivery channel
- **AND** it MUST NOT instruct users to install or register a Chrome Native Messaging Host for normal operation

### Requirement: Historical planning records remain intact
Historical OpenSpec change records SHALL remain available to explain prior Native Messaging decisions and the later WebSocket migration.

#### Scenario: Historical context needed
- **WHEN** developers investigate why Native Messaging existed previously
- **THEN** they MUST be able to use existing OpenSpec change records rather than active setup scripts or current architecture docs as the historical source
