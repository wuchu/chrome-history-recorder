# Classification Progress Display

## Purpose

Define a compact, single-line progress display for AI classification that sits above the category tabs, using Ant Design components.

## Requirements

### Requirement: Display classification progress in compact single-line layout
The Side Panel SHALL display AI classification progress in a compact, single-line layout positioned above the ScrollableTabBar category tabs.

#### Scenario: Show progress bar with completion percentage
- **WHEN** the Side Panel renders classification progress
- **THEN** it SHALL display an Ant Design Progress component with `size="small"`
- **AND** the progress bar SHALL show the completion percentage calculated as `(completed / total) * 100` when `total > 0`
- **AND** the progress bar SHALL show `0%` when `total = 0`

#### Scenario: Progress bar color and animation based on scheduler state
- **WHEN** the classification scheduler is running
- **THEN** the Progress component SHALL have `status="active"` and use antd success/green color
- **AND** the progress bar SHALL show animated stripes moving from left to right
- **WHEN** the classification scheduler is paused
- **THEN** the Progress component SHALL have `status="normal"` and use antd default/blue or yellow color
- **AND** the progress bar SHALL NOT show animation
- **WHEN** there are failed tasks (`failed > 0`)
- **THEN** the Progress component SHALL have `status="exception"` and use antd error/red color

### Requirement: Use small icon buttons with tooltips
The Side Panel SHALL provide classification controls using small Ant Design Button components with Ant Design Icons and Tooltip components for hover text.

#### Scenario: Display start/pause button
- **WHEN** the scheduler is paused
- **THEN** the Side Panel SHALL display a PlayCircleOutlined icon button with `size="small"`, `type="text"`
- **AND** the button SHALL be wrapped in a Tooltip showing "开始分类" (or i18n equivalent)
- **WHEN** the scheduler is running
- **THEN** the Side Panel SHALL display a PauseCircleOutlined icon button with `size="small"`, `type="text"`
- **AND** the button SHALL be wrapped in a Tooltip showing "暂停分类" (or i18n equivalent)

#### Scenario: Display retry failed button
- **WHEN** there are failed tasks (`failed > 0`)
- **THEN** the Side Panel SHALL display a ReloadOutlined icon button with `size="small"`, `type="text"`
- **AND** the button SHALL be wrapped in a Tooltip showing "重试失败任务" (or i18n equivalent)
- **WHEN** there are no failed tasks (`failed = 0`)
- **THEN** the retry button MAY be hidden or disabled

#### Scenario: Display clear queue button
- **WHEN** there are any tasks in the queue (`total > 0`)
- **THEN** the Side Panel SHALL display a DeleteOutlined icon button with `size="small"`, `type="text"`
- **AND** the button SHALL be wrapped in a Tooltip showing "清空队列" (or i18n equivalent)
- **AND** clicking the button SHALL show a confirmation dialog before clearing

### Requirement: Show AI classification label
The progress display SHALL include a visual indicator that this section relates to AI classification.

#### Scenario: Show AI classification icon/label
- **WHEN** the progress display is rendered
- **THEN** it SHALL display a RobotOutlined icon or "🤖 AI 分类" label at the beginning of the line
