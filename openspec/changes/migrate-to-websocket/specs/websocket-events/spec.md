## ADDED Requirements

### Requirement: VFS 连接状态事件
VFS WebSocket Server 必须 (SHALL) 推送连接状态事件。

#### Scenario: 推送 VFS 连接确认
- **WHEN** WebSocket 连接成功建立
- **THEN** 系统必须 (SHALL) 推送 `vfs:connected` 事件
- **AND** 事件数据必须 (SHALL) 包含：
  - `version`: VFS Service 版本
  - `workspacePath`: 工作空间路径

#### Scenario: 推送 VFS 断开通知
- **WHEN** WebSocket 连接即将关闭
- **THEN** 系统必须 (SHALL) 推送 `vfs:disconnected` 事件
- **AND** 事件数据必须 (SHALL) 包含：
  - `reason`: 断开原因

### Requirement: 文件删除事件
VFS WebSocket Server 必须 (SHALL) 推送文件删除事件。

#### Scenario: 推送文件删除事件
- **WHEN** 文件被删除（软删除或硬删除）
- **THEN** 系统必须 (SHALL) 推送 `file:deleted` 事件
- **AND** 事件数据必须 (SHALL) 包含：
  - `hash`: 文件哈希
  - `hard`: 是否硬删除
  - `deletedAt`: 删除时间

### Requirement: 队列状态更新事件
VFS WebSocket Server 必须 (SHALL) 推送队列状态更新事件。

#### Scenario: 推送队列更新事件
- **WHEN** 分类队列状态变化
- **THEN** 系统必须 (SHALL) 推送 `queue:updated` 事件
- **AND** 事件数据必须 (SHALL) 包含：
  - `pending`: 待处理数量
  - `processing`: 正在处理数量
  - `completed`: 已完成数量
  - `failed`: 失败数量

#### Scenario: 队列更新触发条件
- **WHEN** 以下情况发生
- **THEN** 系统必须 (SHALL) 推送队列更新事件：
  - 新任务加入队列
  - 任务开始处理
  - 任务完成
  - 任务失败
  - 任务重试