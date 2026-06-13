## ADDED Requirements

### Requirement: WebSocket 服务端点
Proxy 服务必须 (SHALL) 提供 WebSocket 端点用于实时事件推送。

#### Scenario: WebSocket 连接端点
- **WHEN** 客户端连接 `ws://localhost:3777/events`
- **THEN** 系统必须 (SHALL) 建立 WebSocket 连接
- **AND** 系统必须 (SHALL) 保持连接活跃

#### Scenario: 连接心跳
- **WHEN** WebSocket 连接建立
- **THEN** 系统必须 (SHALL) 定期发送心跳消息
- **AND** 心跳间隔应该 (SHOULD) 为 30 秒
- **AND** 心跳消息格式应该 (SHOULD) 为 `{ "event": "heartbeat" }`

#### Scenario: 客户端断开处理
- **WHEN** 客户端断开连接
- **THEN** 系统必须 (SHALL) 清理该客户端的事件订阅
- **AND** 系统必须 (SHALL) 不影响其他客户端

#### Scenario: 多客户端支持
- **WHEN** 多个客户端同时连接
- **THEN** 系统必须 (SHALL) 支持多客户端并发连接
- **AND** 系统必须 (SHALL) 向所有订阅的客户端广播事件

### Requirement: 文件捕获事件
Proxy 服务必须 (SHALL) 在文件捕获时推送实时事件。

#### Scenario: 推送文件捕获事件
- **WHEN** 新文件成功保存
- **THEN** 系统必须 (SHALL) 推送 `file:captured` 事件
- **AND** 事件数据必须 (SHALL) 包含：
  - `hash`: 文件哈希
  - `filename`: 保存的文件名
  - `mimeType`: MIME 类型
  - `size`: 文件大小（字节）
  - `capturedAt`: 捕获时间（ISO 8601）
  - `url`: 来源 URL
  - `thumbnailUrl`: 缩略图 URL（可选）

#### Scenario: 事件格式
- **WHEN** 推送任何事件
- **THEN** 系统必须 (SHALL) 使用 JSON 格式
- **AND** 格式必须 (SHALL) 为：
  ```json
  {
    "event": "<event-name>",
    "data": { ... },
    "timestamp": "<ISO-8601>"
  }
  ```

### Requirement: 分类状态事件
Extension Background / VFS 事件通道必须 (SHALL) 推送 AI 分类相关事件。

#### Scenario: 推送分类开始事件
- **WHEN** Extension Background 分类器开始处理文件
- **THEN** 系统必须 (SHALL) 推送 `classify:started` 事件
- **AND** 事件数据必须 (SHALL) 包含：
  - `hash`: 正在分类的文件哈希

#### Scenario: 推送分类完成事件
- **WHEN** Extension Background 分类器完成分类
- **THEN** 系统必须 (SHALL) 推送 `classify:complete` 事件
- **AND** 事件数据必须 (SHALL) 包含：
  - `hash`: 文件哈希
  - `category`: 分类结果
  - `filename`: 新文件名
  - `confidence`: 置信度分数（0-1）
  - `tags`: 标签数组
  - `outputPath`: 输出路径

#### Scenario: 推送分类失败事件
- **WHEN** Extension Background 分类器分类失败
- **THEN** 系统必须 (SHALL) 推送 `classify:failed` 事件
- **AND** 事件数据必须 (SHALL) 包含：
  - `hash`: 文件哈希
  - `error`: 错误信息

#### Scenario: 推送分类进度事件
- **WHEN** 分类置信度正在生成
- **THEN** 系统可以 (MAY) 推送 `classify:progress` 事件
- **AND** 事件数据可以 (MAY) 包含：
  - `hash`: 文件哈希
  - `confidence`: 当前置信度

### Requirement: 服务状态事件
Proxy 服务必须 (SHALL) 推送服务状态变化事件。

#### Scenario: 推送服务启动事件
- **WHEN** Proxy 服务启动完成
- **THEN** 系统必须 (SHALL) 推送 `service:started` 事件
- **AND** 事件数据必须 (SHALL) 包含：
  - `version`: Proxy 版本
  - `plugins`: 已加载插件列表

#### Scenario: 推送插件加载事件
- **WHEN** 插件加载完成
- **THEN** 系统必须 (SHALL) 推送 `plugin:loaded` 事件
- **AND** 事件数据必须 (SHALL) 包含：
  - `name`: 插件名称
  - `version`: 插件版本
  - `status`: 状态

#### Scenario: 推送插件状态事件
- **WHEN** 插件状态变化
- **THEN** 系统必须 (SHALL) 推送 `plugin:status` 事件
- **AND** 事件数据必须 (SHALL) 包含插件名称和新状态

### Requirement: 事件订阅过滤
Proxy 服务应该 (SHOULD) 支持事件订阅过滤。

#### Scenario: 订阅特定事件类型
- **WHEN** 客户端发送订阅消息
- **THEN** 系统应该 (SHOULD) 支持只订阅特定事件类型
- **AND** 订阅消息格式应该 (SHOULD) 为：
  ```json
  {
    "action": "subscribe",
    "events": ["file:captured", "classify:complete"]
  }
  ```

#### Scenario: 取消订阅
- **WHEN** 客户端发送取消订阅消息
- **THEN** 系统应该 (SHOULD) 移除相应的事件订阅
- **AND** 系统应该 (SHOULD) 不再向该客户端推送取消订阅的事件

#### Scenario: 默认订阅所有事件
- **WHEN** 客户端连接但未发送订阅消息
- **THEN** 系统必须 (SHALL) 默认订阅所有事件

### Requirement: WebSocket 错误处理
Proxy 服务必须 (SHALL) 正确处理 WebSocket 错误。

#### Scenario: 连接错误通知
- **WHEN** WebSocket 连接发生错误
- **THEN** 系统必须 (SHALL) 发送错误事件
- **AND** 错误事件格式必须 (SHALL) 为：
  ```json
  {
    "event": "error",
    "data": {
      "code": "<error-code>",
      "message": "<error-message>"
    }
  }
  ```

#### Scenario: 关闭连接通知
- **WHEN** 服务即将关闭 WebSocket 连接
- **THEN** 系统必须 (SHALL) 发送关闭事件
- **AND** 关闭事件格式必须 (SHALL) 为：
  ```json
  {
    "event": "close",
    "data": {
      "reason": "<close-reason>"
    }
  }
  ```

### Requirement: Extension WebSocket 客户端
Extension 必须 (SHALL) 实现 WebSocket 客户端连接 VFS Service。

#### Scenario: 自动连接
- **WHEN** Extension DevTools 面板打开
- **THEN** 系统必须 (SHALL) 自动连接到 VFS WebSocket 端点
- **AND** 连接端点必须 (SHALL) 使用当前 VFS Service 地址

#### Scenario: 连接状态显示
- **WHEN** WebSocket 连接状态变化
- **THEN** Extension 必须 (SHALL) 更新界面显示的连接状态
- **AND** 状态必须 (SHALL) 显示：已连接 / 断开 / 重连中

#### Scenario: 断线重连
- **WHEN** WebSocket 连接断开
- **THEN** Extension 必须 (SHALL) 自动尝试重连
- **AND** 重连间隔应该 (SHOULD) 为 5 秒
- **AND** 最大重连尝试应该 (SHOULD) 为无限

#### Scenario: 处理接收事件
- **WHEN** Extension 接收到 WebSocket 事件
- **THEN** Extension 必须 (SHALL) 根据事件类型更新 UI
- **AND** `file:captured` 必须 (SHALL) 添加到实时捕获流
- **AND** `classify:started` 必须 (SHALL) 更新对应项的状态为分类中
- **AND** `classify:complete` 必须 (SHALL) 更新对应项的分类结果