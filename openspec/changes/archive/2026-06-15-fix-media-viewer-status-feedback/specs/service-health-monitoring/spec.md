## MODIFIED Requirements

### Requirement: 服务状态聚合显示
系统必须 (SHALL) 在 DevTools Panel 和共享媒体浏览界面聚合显示多个服务状态。

#### Scenario: 状态栏布局
- **WHEN** DevTools Panel 或 Side Panel 显示服务状态
- **THEN** 系统必须 (SHALL) 在顶部状态栏显示所有服务状态
- **AND** 状态栏应该 (SHOULD) 使用紧凑格式
- **AND** 连接状态圆点必须 (SHALL) 使用统一的视觉尺寸

#### Scenario: 状态区域可点击
- **WHEN** 用户点击某个服务状态区域
- **THEN** 系统应该 (SHOULD) 显示详细状态信息
- **AND** 详细信息必须 (SHALL) 包含：服务名称、当前状态、上次检查时间

#### Scenario: 状态持久化
- **WHEN** 界面重新加载
- **THEN** 系统必须 (SHALL) 立即恢复显示上次的服务状态
- **AND** 系统必须 (SHALL) 立即执行新的健康检查验证状态

