# Service Health Monitoring

## Purpose

Monitor VFS WebSocket and Ollama service health and expose actionable service status in the DevTools Panel.

## Requirements

### Requirement: WebSocket 服务健康监控
系统必须 (SHALL) 提供 WebSocket (VFS) 服务健康状态实时监控。

#### Scenario: 连接状态实时上报
- **WHEN** WebSocket 连接状态变化（连接成功、断开、重连）
- **THEN** 系统必须 (SHALL) 通过 Chrome Extension 消息广播状态事件
- **AND** 事件类型必须 (SHALL) 为 `vfs:connected` 或 `vfs:disconnected`
- **AND** 事件数据必须 (SHALL) 包含时间戳和错误信息（如断开）

#### Scenario: DevTools Panel 显示连接状态
- **WHEN** DevTools Panel 接收到 VFS 状态事件
- **THEN** 系统必须 (SHALL) 更新界面状态显示区域
- **AND** 系统必须 (SHALL) 使用统一尺寸的状态圆点和文字区分连接状态

#### Scenario: 断开时提供用户指引
- **WHEN** WebSocket 连接断开超过 10 秒
- **THEN** 系统必须 (SHALL) 显示用户指引信息
- **AND** 信息必须 (SHALL) 包含："VFS Service 未连接，请确保服务已启动"
- **AND** 信息应该 (SHOULD) 包含启动命令："pnpm vfs:start"

#### Scenario: 手动重试连接
- **WHEN** 用户点击"重试连接"按钮
- **THEN** 系统必须 (SHALL) 触发 WebSocket 客户端重新连接
- **AND** 系统必须 (SHALL) 显示连接尝试动画

### Requirement: Ollama 服务健康监控
系统必须 (SHALL) 提供 Ollama 服务健康状态实时监控。

#### Scenario: 定期健康检查
- **WHEN** Background Worker 初始化完成
- **THEN** 系统必须 (SHALL) 启动定期健康检查
- **AND** 检查间隔应该 (SHOULD) 为 30 秒
- **AND** 检查必须 (SHALL) 调用 Ollama 健康检查 API

#### Scenario: 状态变化广播
- **WHEN** Ollama 健康状态变化（可用 → 不可用，或反之）
- **THEN** 系统必须 (SHALL) 广播 `ollama:status` 事件
- **AND** 事件数据必须 (SHALL) 包含 `available` 布尔值

#### Scenario: DevTools Panel 显示 Ollama 状态
- **WHEN** DevTools Panel 接收到 Ollama 状态事件
- **THEN** 系统必须 (SHALL) 更新界面状态显示区域
- **AND** 系统必须 (SHALL) 使用与其他连接状态一致尺寸的状态圆点区分可用状态

#### Scenario: 不可用时提供用户指引
- **WHEN** Ollama 服务不可用
- **THEN** 系统必须 (SHALL) 显示用户指引信息
- **AND** 信息必须 (SHALL) 包含："Ollama 服务未运行，请确保服务已启动"
- **AND** 信息应该 (SHOULD) 包含启动命令："ollama serve"

#### Scenario: 手动健康检查
- **WHEN** 用户点击"检查 Ollama"按钮
- **THEN** 系统必须 (SHALL) 立即执行健康检查
- **AND** 系统必须 (SHALL) 更新状态显示

### Requirement: 服务状态聚合显示
系统必须 (SHALL) 在 DevTools Panel 和共享媒体浏览界面聚合显示多个服务状态。

#### Scenario: 状态栏布局
- **WHEN** DevTools Panel 显示
- **THEN** 系统必须 (SHALL) 在顶部状态栏显示所有服务状态
- **AND** 状态栏应该 (SHOULD) 使用紧凑格式：`● VFS:已连接  ● Ollama:可用`
- **AND** 连接状态圆点必须 (SHALL) 使用统一的视觉尺寸

#### Scenario: 状态区域可点击
- **WHEN** 用户点击某个服务状态区域
- **THEN** 系统必须 (SHALL) 展开显示详细信息和操作按钮
- **AND** 详细信息必须 (SHALL) 包含：服务名称、当前状态、上次检查时间

#### Scenario: 状态持久化
- **WHEN** DevTools Panel 关闭后重新打开
- **THEN** 系统必须 (SHALL) 立即恢复显示上次的服务状态
- **AND** 系统必须 (SHALL) 立即执行新的健康检查验证状态
