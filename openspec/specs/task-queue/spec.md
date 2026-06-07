## ADDED Requirements

### Requirement: Queue persistence
The system SHALL persist the task queue to enable resumption after restart.

#### Scenario: Save queue to file
- **WHEN** the queue is modified
- **THEN** the system SHALL save the queue state to a JSON file

#### Scenario: Queue file location
- **WHEN** the system initializes
- **THEN** the queue file SHALL be stored in the config file directory
- **AND** the queue file SHALL be named `.ai-classify-queue-tasks.json`

#### Scenario: Old file migration
- **WHEN** old `output/queue.json` exists and new `.ai-classify-queue-tasks.json` does not exist
- **THEN** the system SHALL migrate the old file to the new location

#### Scenario: Load queue on startup
- **WHEN** the system starts
- **THEN** the system SHALL load the existing queue from the JSON file

#### Scenario: Empty queue on first run
- **WHEN** no queue file exists
- **THEN** the system SHALL initialize an empty queue

### Requirement: Queue operations
The system SHALL support standard queue operations.

#### Scenario: Add to queue
- **WHEN** a new file is detected
- **THEN** the system SHALL add it to the pending queue

#### Scenario: Process next item
- **WHEN** processing is ready
- **THEN** the system SHALL move the next item from pending to processing

#### Scenario: Mark complete
- **WHEN** processing succeeds
- **THEN** the system SHALL remove the item from the queue

#### Scenario: Mark failed
- **WHEN** processing fails
- **THEN** the system SHALL move the item to the failed queue

### Requirement: Queue priority
The system SHALL support priority-based processing.

#### Scenario: Priority queue
- **WHEN** items have different priorities
- **THEN** the system SHALL process higher priority items first

#### Scenario: Default priority
- **WHEN** no priority is specified
- **THEN** the system SHALL use default priority (0)

### Requirement: Queue status
The system SHALL provide queue status information.

#### Scenario: Show queue status
- **WHEN** user runs status command
- **THEN** the system SHALL display counts of pending, processing, failed items

#### Scenario: Show queue items
- **WHEN** user requests detailed status
- **THEN** the system SHALL list items in each queue section

### Requirement: Queue recovery
The system SHALL recover from queue corruption.

#### Scenario: Validate queue file
- **WHEN** loading the queue
- **THEN** the system SHALL validate the JSON structure

#### Scenario: Handle corrupted queue
- **WHEN** queue file is corrupted
- **THEN** the system SHALL attempt to recover or create a new empty queue

### Requirement: 任务队列启动处理
系统 必须 (SHALL) 在启动时自动扫描并处理 input 目录下的现有文件。

#### Scenario: 启动时扫描现有文件
- **WHEN** 用户运行 `ai-classify start`
- **THEN** 系统 必须 (SHALL) 扫描 input 目录下的所有文件
- **AND** 系统 必须 (SHALL) 将未处理的文件加入任务队列
- **AND** 系统 必须 (SHALL) 跳过已处理过的文件（基于 hash index）

#### Scenario: 启动后开始监控
- **WHEN** 现有文件扫描并入队完成
- **THEN** 系统 必须 (SHALL) 开始监控 input 目录的变更
- **AND** 新增或修改的文件 必须 (SHALL) 自动加入队列