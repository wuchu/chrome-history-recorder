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
  - `saveFile`: 保存文件（重复内容若在回收站中则自动恢复）
  - `getFile`: 获取文件
  - `trashFile`: 移入回收站
  - `restoreFile`: 从回收站恢复
  - `restoreAll`: 恢复回收站中的全部文件
  - `purgeFile`: 永久删除单个文件
  - `emptyTrash`: 清空回收站
  - `listFiles`: 列出文件（支持 `status: 'active' | 'trashed' | 'all'`）
  - `updateMetadata`: 更新元数据
  - `getMetadata`: 获取元数据
  - `getThumbnail`: 获取缩略图
  - `getStats`: 获取统计（含回收站数量与占用）
  - `getWorkspaceConfig`: 获取工作空间配置
  - `syncBlobsToIndex`: 同步当前 workspace `blobs/` 目录中的原始媒体到 SQLite 索引
  - `enqueueClassification`: 加入分类队列
  - `getQueueStatus`: 获取队列状态
  - `getPendingTasks`: 获取待处理任务
  - `updateTaskStatus`: 更新任务状态
  - `retryFailedTasks`: 重试失败任务
  - `clearQueue`: 清空队列
  - `getTagCounts`: 获取标签使用统计
  - `clearIndex`: 清空 SQLite 索引（不删除物理文件）

### Requirement: 事件广播
VFS Service 必须 (SHALL) 支持向所有连接的客户端广播事件。

#### Scenario: 广播文件事件
- **WHEN** 文件被捕获、移入回收站、恢复、永久删除、清空回收站或分类完成
- **THEN** 系统必须 (SHALL) 广播对应事件
- **AND** 事件格式必须 (SHALL) 为 `{ "type": "event", "event": "<name>", "data": {...}, "timestamp": "<ISO-8601>" }`

#### Scenario: 支持的事件类型
- **WHEN** 广播事件
- **THEN** 系统必须 (SHALL) 支持以下事件类型：
  - `vfs:connected`: VFS 连接确认
  - `vfs:disconnected`: VFS 断开通知
  - `file:captured`: 文件捕获完成
  - `file:trashed`: 文件移入回收站，载荷包含 `{ hash, deletedAt }`
  - `file:restored`: 文件从回收站恢复（含重复采集自动恢复），载荷包含 `{ hash, restoredAt }`
  - `file:purged`: 文件被永久删除，载荷包含 `{ hash }`
  - `trash:emptied`: 回收站清空完成，载荷包含 `{ count }`
  - `trash:restored-all`: 回收站全部恢复完成，载荷包含 `{ count }`
  - `file:classified`: AI 分类完成
  - `queue:updated`: 队列状态更新

#### Scenario: 移除旧删除事件
- **WHEN** 文件被移入回收站或永久删除
- **THEN** 系统必须 (SHALL) 分别广播 `file:trashed` 或 `file:purged`
- **AND** 系统必须 (SHALL) 不再广播 `file:deleted`

#### Scenario: 多客户端广播
- **WHEN** 多个客户端连接到 WebSocket Server
- **THEN** 系统必须 (SHALL) 向所有客户端广播事件
- **AND** 系统必须 (SHALL) 支持至少 10 个并发客户端连接
