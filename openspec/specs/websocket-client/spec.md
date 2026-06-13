## ADDED Requirements

### Requirement: WebSocket 客户端连接
Extension 必须 (SHALL) 实现 WebSocket 客户端连接 VFS Service。

#### Scenario: 自动连接
- **WHEN** DevTools 面板打开
- **THEN** 系统 必须 (SHALL) 自动连接到 VFS WebSocket 端点
- **AND** 连接端点 必须 (SHALL) 使用当前 VFS Service 地址

#### Scenario: 连接状态显示
- **WHEN** WebSocket 连接状态变化
- **THEN** Extension 必须 (SHALL) 更新界面显示的连接状态
- **AND** 状态 必须 (SHALL) 显示：已连接 / 断开 / 重连中

#### Scenario: 断线重连
- **WHEN** WebSocket 连接断开
- **THEN** Extension 必须 (SHALL) 自动尝试重连
- **AND** 重连间隔 应该 (SHOULD) 为 5 秒
- **AND** 最大重连尝试 应该 (SHOULD) 为无限

#### Scenario: 连接失败处理
- **WHEN** WebSocket 连接失败超过 3 次
- **THEN** Extension 应该 (SHOULD) 显示错误提示
- **AND** Extension 应该 (SHOULD) 提供手动重连按钮

### Requirement: 事件接收和处理
Extension 必须 (SHALL) 正确接收和处理 WebSocket 事件。

#### Scenario: 接收 file:captured 事件
- **WHEN** Extension 接收到 `file:captured` 事件
- **THEN** Extension 必须 (SHALL) 添加新文件到实时捕获流
- **AND** Extension 必须 (SHALL) 更新媒体列表

#### Scenario: 接收 classify:started 事件
- **WHEN** Extension 接收到 `classify:started` 事件
- **THEN** Extension 必须 (SHALL) 更新对应项的状态为"分类中"
- **AND** Extension 应该 (SHOULD) 显示分类进度指示器

#### Scenario: 接收 classify:complete 事件
- **WHEN** Extension 接收到 `classify:complete` 事件
- **THEN** Extension 必须 (SHALL) 更新对应项的分类结果
- **AND** Extension 必须 (SHALL) 显示分类、标签和置信度

#### Scenario: 接收 classify:failed 事件
- **WHEN** Extension 接收到 `classify:failed` 事件
- **THEN** Extension 必须 (SHALL) 更新对应项的状态为"失败"
- **AND** Extension 必须 (SHALL) 显示错误信息

### Requirement: useWebSocket Hook
Extension 必须 (SHALL) 提供 useWebSocket hook 管理连接和事件。

#### Scenario: Hook 返回值
- **WHEN** 使用 useWebSocket hook
- **THEN** hook 必须 (SHALL) 返回：
  - `connected`: 连接状态布尔值
  - `events`: 接收的事件数组
  - `send`: 发送消息函数
  - `subscribe`: 订阅事件类型函数

#### Scenario: 配置参数
- **WHEN** 初始化 useWebSocket hook
- **THEN** hook 应该 (SHOULD) 接受配置参数：
  - `endpoint`: WebSocket 端点 URL
  - `onEvent`: 事件处理回调
  - `reconnectInterval`: 重连间隔（毫秒）

#### Scenario: 清理资源
- **WHEN** 组件卸载
- **THEN** hook 必须 (SHALL) 关闭 WebSocket 连接
- **AND** hook 必须 (SHALL) 清理事件监听器