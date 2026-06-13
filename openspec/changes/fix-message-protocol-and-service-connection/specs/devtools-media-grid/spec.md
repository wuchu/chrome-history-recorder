## ADDED Requirements

### Requirement: 历史图片加载消息协议兼容
DevTools 面板必须 (SHALL) 使用正确的消息协议加载历史图片。

#### Scenario: 发送正确消息类型
- **WHEN** useHistoricalImages hook 加载历史图片
- **THEN** 系统必须 (SHALL) 发送消息类型为 'listFiles'（camelCase）
- **AND** 禁止使用 (MUST NOT) 'list-files'（kebab-case）

#### Scenario: 正确包装查询参数
- **WHEN** 发送加载历史图片消息
- **THEN** 系统必须 (SHALL) 将查询参数包装在 `query` 对象中
- **AND** 消息格式必须 (SHALL) 为：`{ type: 'listFiles', query: { limit, offset, category } }`

#### Scenario: 正确处理响应
- **WHEN** 接收到历史图片加载响应
- **THEN** 系统必须 (SHALL) 检查 `success` 字段
- **AND** 系统必须 (SHALL) 从 `data` 字段提取图片列表和元数据
- **AND** 系统必须 (SHALL) 正确处理 `{ success: false, error }` 错误响应

#### Scenario: 加载失败时显示错误
- **WHEN** 历史图片加载失败
- **THEN** 系统必须 (SHALL) 在界面显示错误信息
- **AND** 错误信息应该 (SHOULD) 包含具体原因（如 "VFS Service 未连接"）

### Requirement: 服务状态联动显示
DevTools 面板必须 (SHALL) 与服务健康监控联动显示状态。

#### Scenario: 显示 WebSocket 连接状态
- **WHEN** DevTools 面板加载
- **THEN** 系统必须 (SHALL) 立即显示 VFS WebSocket 连接状态
- **AND** 状态必须 (SHALL) 实时更新（基于接收到的事件）

#### Scenario: 显示 Ollama 服务状态
- **WHEN** DevTools 面板加载
- **THEN** 系统必须 (SHALL) 立即显示 Ollama 服务状态
- **AND** 状态必须 (SHALL) 实时更新（基于接收到的事件）

#### Scenario: 服务未连接时禁用相关功能
- **WHEN** VFS WebSocket 未连接
- **THEN** 系统必须 (SHALL) 禁用历史图片加载功能
- **AND** 系统必须 (SHALL) 显示 "服务未连接" 提示
- **AND** 系统应该 (SHOULD) 提供重试连接按钮