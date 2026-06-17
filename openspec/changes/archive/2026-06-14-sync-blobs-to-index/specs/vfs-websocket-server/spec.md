## MODIFIED Requirements

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
  - `syncBlobsToIndex`: 同步当前 workspace `blobs/` 目录中的原始媒体到 SQLite 索引
  - `enqueueClassification`: 加入分类队列
  - `getQueueStatus`: 获取队列状态
  - `getPendingTasks`: 获取待处理任务
  - `updateTaskStatus`: 更新任务状态
  - `retryFailedTasks`: 重试失败任务
  - `clearQueue`: 清空队列
