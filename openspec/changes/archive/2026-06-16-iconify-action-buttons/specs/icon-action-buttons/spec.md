## ADDED Requirements

### Requirement: Capture button uses icon
StatusBar 中的捕获按钮 SHALL 使用图标而非文字显示。

#### Scenario: Idle state shows play icon
- **WHEN** 系统处于非捕获状态
- **THEN** 显示播放图标（PlayCircleOutlined）

#### Scenario: Capturing state shows pause icon
- **WHEN** 系统正在捕获
- **THEN** 显示暂停图标（PauseCircleOutlined）

### Requirement: Clear events button uses icon
清空事件按钮 SHALL 使用图标而非文字显示。

#### Scenario: Clear button shows delete icon
- **WHEN** sidepanel 工具栏显示
- **THEN** 清空事件按钮显示删除图标（ClearOutlined）

### Requirement: Settings button uses icon
设置按钮 SHALL 使用图标而非文字显示。

#### Scenario: Settings button shows gear icon
- **WHEN** sidepanel 工具栏显示
- **THEN** 设置按钮显示齿轮图标（SettingOutlined）

### Requirement: All icon buttons have tooltips
所有图标按钮 SHALL 在鼠标悬停时显示 tooltip 提示。

#### Scenario: Hover shows tooltip for capture button
- **WHEN** 用户将鼠标悬停在捕获按钮上
- **THEN** 显示"开始捕获"或"停止捕获"的提示文字

#### Scenario: Hover shows tooltip for clear button
- **WHEN** 用户将鼠标悬停在清空事件按钮上
- **THEN** 显示"清空事件"的提示文字

#### Scenario: Hover shows tooltip for settings button
- **WHEN** 用户将鼠标悬停在设置按钮上
- **THEN** 显示"设置"的提示文字

### Requirement: Icon buttons arranged in StatusBar right
三个图标按钮 SHALL 按顺序排列在 StatusBar 的右侧。

#### Scenario: Button order in StatusBar
- **WHEN** StatusBar 渲染
- **THEN** 按钮从左到右依次为：捕获按钮、清空事件按钮、设置按钮

### Requirement: Icon buttons have consistent styling
所有图标按钮 SHALL 具有一致的样式和间距。

#### Scenario: Buttons have proper spacing
- **WHEN** 图标按钮显示
- **THEN** 按钮之间有适当的间距（8px）

#### Scenario: Buttons have hover state
- **WHEN** 用户将鼠标悬停在图标按钮上
- **THEN** 按钮背景色变化以提供视觉反馈
