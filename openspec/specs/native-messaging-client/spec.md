# Spec: Native Messaging Client

## Purpose

Extension 的 Native Messaging 客户端实现

## Requirements


### Requirement: Extension implements Native Messaging client

The Extension Background Service Worker SHALL implement a Native Messaging client that communicates with the VFS Service Native Host.

#### Scenario: Initialize Native Messaging connection
- **WHEN** Extension Background Service Worker starts
- **THEN** Background creates connection using chrome.runtime.connectNative('com.yourapp.vfs') and stores Port object for message handling

#### Scenario: Send Native Message
- **WHEN** Background calls VFSClient.send(method, params)
- **THEN** Background posts message to Port with { method, params, id: <unique_id> }

#### Scenario: Receive Native Message response
- **WHEN** Native Host sends response via Port.onMessage
- **THEN** Background parses response JSON, resolves pending promise by matching id, and handles errors

#### Scenario: Handle Native Host disconnect
- **WHEN** Native Host disconnects (Port.onDisconnect fires)
- **THEN** Background logs error, marks connection as disconnected, and broadcasts { type: 'vfs:disconnected' } to DevTools Panel

#### Scenario: Reconnect on disconnect
- **WHEN** Background detects Native Host disconnected
- **THEN** Background waits 5000ms, then attempts chrome.runtime.connectNative again

### Requirement: Extension handles Native Messaging errors

The Extension SHALL handle Native Messaging errors gracefully and provide user feedback.

#### Scenario: Native Host not installed
- **WHEN** chrome.runtime.connectNative fails with "Native messaging host not found" error
- **THEN** Background logs error, broadcasts { type: 'vfs:error', data: { message: 'Native host not installed' } }, and DevTools Panel shows installation instructions

#### Scenario: Native Host crashes
- **WHEN** Native Host process crashes during operation
- **THEN** Background detects disconnect, logs error, and attempts reconnect with exponential backoff

#### Scenario: Native Host returns error
- **WHEN** Native Host response contains { error: <message> }
- **THEN** Background rejects promise, logs error, and optionally shows error toast in DevTools Panel

### Requirement: Extension configures Native Messaging host name

The Extension SHALL use configurable Native Messaging host name for flexibility.

#### Scenario: Use default host name
- **WHEN** Extension starts without custom configuration
- **THEN** Background uses 'com.yourapp.vfs' as host name

#### Scenario: Use custom host name from config
- **WHEN** Extension config specifies nativeHostName: 'com.custom.vfs'
- **THEN** Background uses configured host name for connectNative
