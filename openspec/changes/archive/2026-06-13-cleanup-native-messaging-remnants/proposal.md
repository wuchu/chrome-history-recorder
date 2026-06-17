## Why

The WebSocket + HTTP migration is implemented, but Native Messaging-era scripts, templates, tests, package metadata, and architecture documentation still remain. These remnants create confusing setup guidance and currently leave the VFS Service test suite with a stale test importing deleted Native Messaging source.

## What Changes

- Remove obsolete Native Messaging host installation scripts from the root `scripts/` directory.
- Remove the unused Native Messaging manifest template from `packages/vfs-service/templates/`.
- Remove or replace stale Native Messaging tests and test descriptions so the VFS Service suite only covers supported transports.
- Update VFS Service package metadata to describe the current WebSocket + HTTP service rather than a Native Messaging Host.
- Update architecture documentation to reflect the current WebSocket + HTTP dual-channel design and remove instructions that direct users to register a Native Messaging Host.
- No runtime API behavior changes are intended; this is a cleanup and documentation consistency change.

## Capabilities

### New Capabilities
- `architecture-consistency`: Ensures active project documentation, setup assets, package metadata, and tests describe and validate the currently supported WebSocket + HTTP architecture rather than removed transports.

### Modified Capabilities

## Impact

- `scripts/install-native-host.sh` and `scripts/install-native-host.ps1` will be removed if no other supported flow references them.
- `packages/vfs-service/templates/com.chromehistoryrecorder.vfs.json` will be removed if unused by the current WebSocket + HTTP service.
- `packages/vfs-service/test/native-messaging.test.ts` and Native Messaging wording in related tests will be removed or rewritten.
- `packages/vfs-service/package.json` metadata will be updated.
- `ARCHITECTURE.md` will be updated to match the current WebSocket + HTTP architecture.
- Validation should include `pnpm --filter vfs-service test --run` or the project’s equivalent non-watch test command.
