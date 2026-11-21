# Spec: App Event Bus

## Purpose

Aggregate file, task, classification, and tag events in the app process and forward them to the extension and its UI panels.

## Requirements

### Requirement: App aggregates events

The app SHALL own an event bus that collects file, task, classification, and tag events from the `vfs` layer, the `ai` package, and the scheduler.

#### Scenario: Collect scheduler events
- **WHEN** a task starts, completes, or fails
- **THEN** the scheduler SHALL publish the event into the app event bus

#### Scenario: Collect file events
- **WHEN** a file is captured, moved to the trash, restored, permanently deleted, or the trash is emptied
- **THEN** the corresponding `file:captured`, `file:trashed`, `file:restored`, `file:purged`, `trash:emptied`, or `trash:restored-all` event SHALL enter the app event bus
- **AND** `file:deleted` SHALL NOT be published

#### Scenario: Collect automatic restore events
- **WHEN** a duplicate capture restores a trashed file
- **THEN** a `file:restored` event SHALL enter the app event bus

### Requirement: Push events to the extension

The app SHALL forward bus events to the extension through the `vfs` transport.

#### Scenario: Forward a task event
- **WHEN** the event bus receives a task event
- **THEN** the app SHALL push it over the WebSocket to connected extension clients

#### Scenario: Serialized delivery
- **WHEN** multiple events are published
- **THEN** the app SHALL deliver them in order per connected client

### Requirement: Extension relays events to UI

The extension SHALL relay app-originated events to UI panels through `chrome.runtime` messaging.

#### Scenario: Relay to side panel
- **WHEN** the extension receives an app event over the WebSocket
- **THEN** it SHALL rebroadcast it to UI panels so their existing subscriptions keep working
