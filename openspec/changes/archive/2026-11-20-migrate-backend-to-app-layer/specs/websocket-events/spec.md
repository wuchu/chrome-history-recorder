## MODIFIED Requirements

### Requirement: 分类状态事件

app 事件总线必须 (SHALL) 聚合 AI 分类相关事件，并通过 vfs transport 推送给 extension。

#### Scenario: 推送分类开始事件
- **WHEN** app 调度器开始处理一个 `classify` 任务
- **THEN** 系统必须 (SHALL) 推送 `classify:started` 事件
- **AND** 事件数据必须 (SHALL) 包含：
  - `hash`: 正在分类的文件哈希

#### Scenario: 推送分类完成事件
- **WHEN** app 的 `ai` 包完成分类
- **THEN** 系统必须 (SHALL) 推送 `classify:complete` 事件
- **AND** 事件数据必须 (SHALL) 包含：
  - `hash`: 文件哈希
  - `tags`: 标签数组
  - `confidence`: 置信度分数（0-1）
  - `ai_filename`: 生成的显示文件名

#### Scenario: 推送分类失败事件
- **WHEN** app 的 `ai` 包分类失败
- **THEN** 系统必须 (SHALL) 推送 `classify:failed` 事件
- **AND** 事件数据必须 (SHALL) 包含：
  - `hash`: 文件哈希
  - `error`: 错误信息

#### Scenario: 推送任务状态事件
- **WHEN** app 调度器处理 `classify` 或 `rename` 任务
- **THEN** 系统必须 (SHALL) 推送 `task:started`、`task:completed`、`task:retrying` 或 `task:failed` 事件
- **AND** 事件数据必须 (SHALL) 包含 `task_type` 和 `hash`
