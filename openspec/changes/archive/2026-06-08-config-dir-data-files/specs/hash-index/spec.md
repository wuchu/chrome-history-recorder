## MODIFIED Requirements

### Requirement: 索引文件存储
索引文件 必须 (SHALL) 存储在配置文件同目录。

#### Scenario: 索引文件路径
- **WHEN** 配置文件在 `<dir>/.ai-classify.json`
- **THEN** 索引文件 必须 (SHALL) 在 `<dir>/.ai-classify-index.json`