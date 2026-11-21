## MODIFIED Requirements

### Requirement: 扩展激活控制
扩展必须 (SHALL) 在 Side Panel 中允许用户启用或禁用当前标签页的图片捕获；捕获会话是全局单会话，而不是每个标签页各自维护一个活动会话。

#### Scenario: 在 Side Panel 中切换捕获开关
- **WHEN** 用户在 Side Panel 点击切换按钮
- **THEN** Side Panel 必须 (SHALL) 请求 Background 启用或禁用当前标签页的图片捕获功能
- **AND** Background 必须 (SHALL) 为该标签页附着或释放 debugger/CDP 捕获后端

**捕获开关默认状态**:
- **Side Panel 打开时**: 捕获开关默认为 **关闭（禁用）**，除非已存在该标签页的活跃捕获状态
- **用户操作**: 需手动点击"启用捕获"按钮开始捕获
- **刷新面板**: 面板必须 (SHALL) 从 Background 读取当前标签页捕获状态
- **原因**: 用户主动控制更符合预期，避免打开 Side Panel 就自动捕获大量图片导致性能或隐私问题

**捕获开关作用范围**:
- **范围**: 全局单会话；同一时间最多一个标签页处于捕获状态
- **切换标签页**: 在另一个标签页开始捕获时，系统必须 (SHALL) 先停止旧会话（Side Panel 要求用户确认）
- **状态存储**: Background 必须 (SHALL) 使用全局会话状态管理当前捕获标签页
- **关闭标签页**: Background 必须 (SHALL) 停止并清理该标签页的捕获会话

#### Scenario: 面板显示状态指示器
- **WHEN** 扩展处于活动状态
- **THEN** Side Panel 必须 (SHALL) 显示活动状态和实时捕获计数

**状态指示器显示内容**:
- 活动状态：显示 "Capturing" 或 "Paused"
- 实时计数：当前标签页的捕获数量（动态更新）
- 视觉样式：使用图标或文字标识

## ADDED Requirements

### Requirement: One-shot capture fallback for page-local images

The extension SHALL provide a user-initiated one-shot path for images that the CDP network path cannot read, while leaving the network capture path unchanged.

#### Scenario: Data and blob images
- **WHEN** the user saves an image or runs a page scan on an explicit action
- **THEN** the one-shot path SHALL attempt to save `data:` and `blob:` images
- **AND** it SHALL NOT attach the debugger
- **AND** it SHALL NOT create or modify a capture session

#### Scenario: Network capture remains network-only
- **WHEN** the global CDP capture session is active
- **THEN** `Network.responseReceived` handling SHALL continue to ignore `data:` and `blob:` URLs
- **AND** the one-shot path SHALL be the supported way to save them

#### Scenario: No automatic scanning
- **WHEN** no one-shot action is invoked
- **THEN** the extension SHALL NOT read page DOM for capture

### Requirement: One-shot capture permissions

The extension manifest SHALL include the permissions required for user-initiated one-shot capture without broadening host access.

#### Scenario: Manifest permissions
- **WHEN** `wxt.config.ts` generates the manifest
- **THEN** it SHALL include `contextMenus` and `scripting`
- **AND** it SHALL keep the existing `<all_urls>` host permission
- **AND** it SHALL NOT add a new host permission for one-shot capture

#### Scenario: Context menu registration
- **WHEN** the extension starts or is installed
- **THEN** it SHALL register the image context menu item
- **AND** repeated registration SHALL be idempotent
