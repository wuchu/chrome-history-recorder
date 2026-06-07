## MODIFIED Requirements

### Requirement: 队列文件存储
队列文件 必须 (SHALL) 存储在配置文件同目录。

#### Scenario: 队列文件路径
- **WHEN** 配置文件在 `<dir>/.ai-classify.json`
- **THEN** 队列文件 必须 (SHALL) 在 `<dir>/.ai-classify-queue-tasks.json`