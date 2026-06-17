## ADDED Requirements

### Requirement: DevTools opens dedicated settings page
The DevTools panel SHALL provide access to the dedicated extension Options page instead of embedding full program configuration forms.

#### Scenario: Show settings entry point
- **WHEN** the DevTools panel renders
- **THEN** it SHALL show a visible action for opening extension settings
- **AND** the action SHALL open the extension Options page

#### Scenario: Settings action failure
- **WHEN** opening the extension Options page fails
- **THEN** the DevTools panel SHALL surface an error or fallback message to the user

## REMOVED Requirements

### Requirement: 配置面板折叠
**Reason**: Full program configuration is moving from DevTools into the dedicated extension Options page, so DevTools no longer owns an embedded collapsible configuration panel.
**Migration**: DevTools SHALL expose an action to open the Options page and SHALL keep media browsing, capture, status, and classification progress surfaces outside the old configuration panel.

#### Scenario: 默认折叠配置
- **WHEN** DevTools 面板打开
- **THEN** 系统必须 (SHALL) 默认折叠配置面板
- **AND** 系统必须 (SHALL) 显示"配置"展开按钮

#### Scenario: 展开配置面板
- **WHEN** 用户点击配置按钮
- **THEN** 系统必须 (SHALL) 展开显示完整配置面板

#### Scenario: 折叠配置面板
- **WHEN** 用户再次点击配置按钮
- **THEN** 系统必须 (SHALL) 折叠隐藏配置面板

#### Scenario: 快捷过滤条
- **WHEN** 配置面板折叠
- **THEN** 系统必须 (SHALL) 显示快捷过滤条
- **AND** 过滤条必须 (SHALL) 包含：类型下拉、大小下拉、搜索框
