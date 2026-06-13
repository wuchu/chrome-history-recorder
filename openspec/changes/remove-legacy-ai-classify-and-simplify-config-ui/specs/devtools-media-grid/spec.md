## MODIFIED Requirements

### Requirement: 配置面板折叠
DevTools 面板必须 (SHALL) 提供简化的配置区域，且配置区域必须聚焦当前 Extension/VFS 工作流的状态与操作。

#### Scenario: 默认显示简化配置
- **WHEN** DevTools 面板打开
- **THEN** 系统必须 (SHALL) 显示可操作的服务状态和 AI 分类配置摘要
- **AND** 系统必须 (SHALL) 避免默认展示低频捕获过滤表单

#### Scenario: 展示当前运行时控制
- **WHEN** 配置区域显示
- **THEN** 系统必须 (SHALL) 展示当前 VFS、Ollama、模型选择或分类控制相关内容
- **AND** 系统必须 (SHALL) 不展示已经退役的 Proxy 或 standalone CLI 配置项

#### Scenario: 快捷过滤条
- **WHEN** 用户浏览媒体网格
- **THEN** 系统可以 (MAY) 显示与媒体浏览直接相关的搜索或过滤控件
- **AND** 这些控件必须 (SHALL) 不依赖 standalone CLI 配置

### Requirement: 服务状态聚合
DevTools 面板必须 (SHALL) 显示当前 Extension/VFS 架构下的服务状态。

#### Scenario: 显示 VFS 状态
- **WHEN** DevTools 面板显示
- **THEN** 系统必须 (SHALL) 显示 VFS Service 或 VFS WebSocket 连接状态
- **AND** 状态必须 (SHALL) 使用图标和文字

#### Scenario: 显示 Ollama 状态
- **WHEN** DevTools 面板显示
- **THEN** 系统必须 (SHALL) 显示 Ollama 服务可用状态
- **AND** 不可用时必须 (SHALL) 提供可操作的检查或重试提示

#### Scenario: 显示 AI 分类状态
- **WHEN** 分类队列状态可用
- **THEN** 系统必须 (SHALL) 显示 AI 分类运行中或暂停状态
- **AND** 状态必须 (SHALL) 包含当前队列处理数量

#### Scenario: 状态图标聚合
- **WHEN** 多个服务状态显示
- **THEN** 系统必须 (SHALL) 在状态栏聚合显示当前可用性
