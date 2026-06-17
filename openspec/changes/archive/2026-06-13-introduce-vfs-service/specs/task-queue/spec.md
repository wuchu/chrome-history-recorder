## MODIFIED Requirements

### Requirement: Extension manages classification task queue

The Extension Background Service Worker SHALL manage classification task queue through VFS classify_queue table.

#### Scenario: Initialize queue from existing files
- **WHEN** Extension Background starts
- **THEN** Background calls VFS.listFiles for uncategorized files, and calls VFS.enqueueClassification for each

#### Scenario: Process pending tasks with concurrency limit
- **WHEN** Classification scheduler runs
- **THEN** Background processes up to concurrency (configurable, default 3) tasks simultaneously, marking each as 'processing' before calling Ollama

#### Scenario: Complete task and update metadata
- **WHEN** Ollama classification returns result
- **THEN** Background calls VFS.updateMetadata with classification result, and updates task status to 'completed'

#### Scenario: Fail task on error
- **WHEN** Classification throws error
- **THEN** Background updates task status to 'failed', stores error message, and increments retries count

#### Scenario: Retry failed tasks
- **WHEN** User requests retry failed tasks
- **THEN** Background resets status to 'pending' for all failed tasks, clears error, and triggers scheduler

### Requirement: Queue supports priority ordering

The classify_queue table SHALL support task priority ordering with higher priority tasks processed first.

#### Scenario: Enqueue with priority
- **WHEN** File is captured and enqueued
- **THEN** VFS inserts task with priority=5 (default)

#### Scenario: Process tasks by priority
- **WHEN** Scheduler queries pending tasks
- **THEN** VFS returns tasks sorted by priority DESC, addedAt ASC