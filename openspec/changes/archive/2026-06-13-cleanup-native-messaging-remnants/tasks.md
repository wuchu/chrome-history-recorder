## 1. Inventory and Safety Checks

- [x] 1.1 Search active source, package scripts, README, and architecture docs for Native Messaging setup references outside historical OpenSpec records
- [x] 1.2 Confirm root `scripts/install-native-host.sh`, `scripts/install-native-host.ps1`, and `packages/vfs-service/templates/com.chromehistoryrecorder.vfs.json` are not referenced by supported flows
- [x] 1.3 Inspect `packages/vfs-service/test/native-messaging.test.ts` and compare its supported API/dispatcher coverage against existing runnable tests

## 2. Remove Obsolete Native Messaging Artifacts

- [x] 2.1 Delete root Native Messaging host install scripts from `scripts/`
- [x] 2.2 Delete the unused Native Messaging manifest template from `packages/vfs-service/templates/`
- [x] 2.3 Remove `packages/vfs-service/test/native-messaging.test.ts` or migrate uniquely useful supported coverage into current API, dispatcher, WebSocket, or integration tests
- [x] 2.4 Update Native Messaging wording in runnable integration tests so comments and describe blocks reflect current WebSocket/HTTP or transport-neutral behavior

## 3. Update Metadata and Documentation

- [x] 3.1 Update `packages/vfs-service/package.json` description and keywords to describe the current WebSocket + HTTP VFS Service
- [x] 3.2 Update `ARCHITECTURE.md` overview diagram and component descriptions to use WebSocket + HTTP instead of `chrome.runtime.connectNative()` and Native Messaging Host terminology
- [x] 3.3 Update architecture decision and risk sections to describe the current WebSocket + HTTP choice, service startup requirement, and port/service availability trade-offs
- [x] 3.4 Confirm README remains consistent with the updated architecture and does not direct users to Native Messaging installation scripts

## 4. Validation

- [x] 4.1 Run a non-watch VFS Service test command and verify the stale Native Messaging import failure is gone
- [x] 4.2 Run a repository search for active Native Messaging remnants and verify remaining matches are either historical OpenSpec records or intentional explanatory references
- [x] 4.3 If generated `packages/vfs-service/dist/` files are tracked and expected to stay current, rebuild the VFS Service and review generated output changes
- [x] 4.4 Verify the change satisfies the `architecture-consistency` spec scenarios
