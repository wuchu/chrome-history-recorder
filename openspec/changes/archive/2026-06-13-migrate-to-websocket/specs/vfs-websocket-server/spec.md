## ADDED Requirements

### Requirement: WebSocket Server 端点
VFS Service 必须 (SHALL) 提供 WebSocket 端点用于 API 调用和事件推送。

#### Scenario: WebSocket 连接端点
- **WHEN** 客户端连接 `ws://localhost:8765`
- **THEN** 系统必须 (SHALL) 建立 WebSocket 连接
- **AND** 系统必须 (SHALL) 保持连接活跃

#### Scenario: 连接确认
- **WHEN** WebSocket 连接成功建立
- **THEN** 系统必须 (SHALL) 发送连接确认消息
- **AND** 消息格式必须 (SHALL) 为 `{ "type": "connected", "timestamp": "<ISO-8601>" }`

#### Scenario: API 请求响应
- **WHEN** 客户端发送 API 请求 `{ "id": <number>, "method": "<name>", "params": {...} }`
- **THEN** 系统必须 (SHALL) 路由到对应 API 方法
- **AND** 系统必须 (SHALL) 返回响应 `{ "id": <number>, "success": <boolean>, "data": {...} }`

#### Scenario: 支持的 API 方法
- **WHEN** 客户端调用 API 方法
- **THEN** 系统必须 (SHALL) 支持以下方法：
  - `saveFile`: 保存文件
  - `getFile`: 获取文件
  - `deleteFile`: 删除文件
  - `listFiles`: 列出文件
  - `updateMetadata`: 更新元数据
  - `getMetadata`: 获取元数据
  - `getThumbnail`: 获取缩略图
  - `getStats`: 获取统计
  - `getWorkspaceConfig`: 获取工作空间配置
  - `enqueueClassification`: 加入分类队列
  - `getQueueStatus`: 获取队列状态
  - `getPendingTasks`: 获取待处理任务
  - `updateTaskStatus`: 更新任务状态
  - `retryFailedTasks`: 重试失败任务
  - `clearQueue`: 清空队列

### Requirement: 事件广播
VFS Service 必须 (SHALL) 支持向所有连接的客户端广播事件。

#### Scenario: 广播文件事件
- **WHEN** 文件被捕获、删除或分类完成
- **THEN** 系统必须 (SHALL) 广播对应事件
- **AND** 事件格式必须 (SHALL) 为 `{ "type": "event", "event": "<name>", "data": {...}, "timestamp": "<ISO-8601>" }`

#### Scenario: 支持的事件类型
- **WHEN** 广播事件
- **THEN** 系统必须 (SHALL) 支持以下事件类型：
  - `vfs:connected`: VFS 连接确认
  - `vfs:disconnected`: VFS 断开通知
  - `file:captured`: 文件捕获完成
  - `file:deleted`: 文件删除完成
  - `file:classified`: AI 分类完成
  - `queue:updated`: 队列状态更新

#### Scenario: 多客户端广播
- **WHEN** 多个客户端连接到 WebSocket Server
- **THEN** 系统必须 (SHALL) 向所有客户端广播事件
- **AND** 系统必须 (SHALL) 支持至少 10 个并发客户端连接

### Requirement: 连接管理
VFS Service 必须 (SHALL) 正确管理 WebSocket 连接生命周期。

#### Scenario: 客户端断开处理
- **WHEN** 客户端断开连接
- **THEN** 系统必须 (SHALL) 清理该客户端的资源
- **AND** 系统必须 (SHALL) 不影响其他客户端

#### Scenario: 心跳机制
- **WHEN** WebSocket 连接建立
- **THEN** 系统应该 (SHOULD) 定期发送心跳消息
- **AND** 心跳间隔应该 (SHOULD) 为 30 秒
- **AND** 心跳消息格式应该 (SHOULD) 为 `{ "type": "heartbeat" }`

#### Scenario: 连接超时处理
- **WHEN** 客户端在 60 秒内未响应心跳
- **THEN** 系统可以 (MAY) 关闭该客户端连接

### Requirement: 错误处理
VFS Service 必须 (SHALL) 正确处理 WebSocket 错误。

#### Scenario: API 错误响应
- **WHEN** API 调用失败
- **THEN** 系统必须 (SHALL) 返回错误响应
- **AND** 格式必须 (SHALL) 为 `{ "id": <number>, "success": false, "error": "<message>" }`

#### Scenario: 未知方法处理
- **WHEN** 客户端调用未知方法
- **THEN** 系统必须 (SHALL) 返回错误响应
- **AND** 错误消息必须 (SHALL) 包含 `Unknown method: <name>`

#### Scenario: 连接错误通知
- **WHEN** WebSocket 连接发生错误
- **THEN** 系统必须 (SHALL) 记录错误日志
- **AND** 系统必须 (SHALL) 不影响其他客户端连接