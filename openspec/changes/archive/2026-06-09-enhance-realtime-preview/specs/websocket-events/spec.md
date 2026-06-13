## ADDED Requirements

### Requirement: WebSocket 服务实现
Proxy 服务必须 (SHALL) 实现完整的服务端 WebSocket 功能。

#### Scenario: WebSocket 服务初始化
- **WHEN** Proxy 服务启动
- **THEN** 系统必须 (SHALL) 创建 WebSocketServer 实例
- **AND** 系统必须 (SHALL) 监听配置的端口
- **AND** 系统应该 (SHOULD) 在启动日志中显示 WebSocket 端点

#### Scenario: 广播事件方法
- **WHEN** Plugin 或路由需要推送事件
- **THEN** 系统必须 (SHALL) 提供 `broadcast(event, data)` 方法
- **AND** 系统必须 (SHALL) 向所有连接的客户端发送事件
- **AND** 系统必须 (SHALL) 使用标准事件格式：
  ```json
  {
    "event": "<event-name>",
    "data": { ... },
    "timestamp": "<ISO-8601>"
  }
  ```

#### Scenario: file:captured 事件发射
- **WHEN** 新文件通过 `/save-image` 端点保存
- **THEN** 系统必须 (SHALL) 发射 `file:captured` 事件
- **AND** 事件数据必须 (SHALL) 包含：
  - `hash`: 文件哈希
  - `filename`: 保存的文件名
  - `mimeType`: MIME 类型
  - `size`: 文件大小
  - `url`: 来源 URL
  - `thumbnailUrl`: 缩略图 URL

#### Scenario: 连接状态追踪
- **WHEN** 客户端连接或断开
- **THEN** 系统应该 (SHOULD) 记录连接状态
- **AND** 系统应该 (SHOULD) 提供 API 查询当前连接数