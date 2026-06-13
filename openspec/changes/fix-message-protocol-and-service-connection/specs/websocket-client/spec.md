## ADDED Requirements

### Requirement: 连接状态主动广播
WebSocket 客户端必须 (SHALL) 在连接状态变化时主动广播事件。

#### Scenario: 连接成功广播
- **WHEN** WebSocket 连接成功建立
- **THEN** 系统必须 (SHALL) 立即调用 `onConnect` 回调
- **AND** Background Worker 必须 (SHALL) 广播 `vfs:connected` 事件
- **AND** 事件数据必须 (SHALL) 包含连接时间戳

#### Scenario: 断开连接广播
- **WHEN** WebSocket 连接断开（网络错误、服务关闭）
- **THEN** 系统必须 (SHALL) 立即调用 `onDisconnect` 回调
- **AND** Background Worker 必须 (SHALL) 广播 `vfs:disconnected` 事件
- **AND** 事件数据必须 (SHALL) 包含错误原因和时间戳

#### Scenario: 重连成功广播
- **WHEN** WebSocket 重连成功
- **THEN** 系统必须 (SHALL) 广播 `vfs:connected` 事件
- **AND** 事件数据应该 (SHOULD) 包含重连次数信息

#### Scenario: 重连失败广播
- **WHEN** WebSocket 重连失败（达到最大重试次数）
- **THEN** 系统必须 (SHALL) 广播 `vfs:disconnected` 事件
- **AND** 事件数据必须 (SHALL) 包含 "达到最大重连次数" 信息

### Requirement: 连接状态查询接口
WebSocket 客户端必须 (SHALL) 提供连接状态查询接口。

#### Scenario: isVFSConnected 消息处理
- **WHEN** 接收到 `isVFSConnected` 消息
- **THEN** Background Worker 必须 (SHALL) 返回当前 WebSocket 连接状态
- **AND** 响应格式必须 (SHALL) 为 `{ connected: boolean }`

#### Scenario: 定期状态检查
- **WHEN** WebSocket 客户端初始化
- **THEN** 系统应该 (SHOULD) 启动定期状态检查（每 5 秒）
- **AND** 系统应该 (SHOULD) 在状态变化时触发回调

### Requirement: 用户友好的连接提示
WebSocket 客户端应该 (SHOULD) 提供用户友好的连接提示。

#### Scenario: 连接失败提示
- **WHEN** WebSocket 连接失败超过 3 次
- **THEN** 系统应该 (SHOULD) 记录详细错误日志
- **AND** 错误日志应该 (SHOULD) 包含：服务地址、错误原因、重试次数

#### Scenario: 服务地址显示
- **WHEN** 显示连接状态详情
- **THEN** 系统应该 (SHOULD) 显示 WebSocket 服务地址
- **AND** 地址应该 (SHOULD) 为：`ws://localhost:8765`