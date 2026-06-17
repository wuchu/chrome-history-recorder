## ADDED Requirements

### Requirement: DevTools media panel uses natural page scrolling
The DevTools media panel SHALL allow the media grid to participate in normal page flow and SHALL use the DevTools panel page/body as the primary vertical scroll surface.

#### Scenario: Media grid does not create nested vertical scrolling
- **WHEN** the DevTools panel renders the media grid
- **THEN** the media grid SHALL NOT render inside a fixed-height internal vertical scrollbar
- **AND** the panel page/body SHALL provide the primary vertical scrolling behavior

#### Scenario: Loading more media with page scrolling
- **WHEN** the user scrolls near the bottom of the DevTools panel page and more media exists
- **THEN** the system SHALL request the next page of media
- **AND** newly loaded media SHALL append to the existing grid without requiring a separate grid scrollbar

### Requirement: DevTools classification progress is compact
The DevTools panel SHALL show classification progress as a single compact row that preserves core queue visibility and actions without a large progress dashboard.

#### Scenario: Compact classification row
- **WHEN** the DevTools panel renders classification progress
- **THEN** the system SHALL show scheduler state and pending, processing, completed, and failed counts in a compact row
- **AND** the row SHALL preserve start or pause, retry failed, and clear queue actions when those actions are available

#### Scenario: Large classification dashboard removed
- **WHEN** the DevTools panel renders classification progress
- **THEN** the system SHALL NOT show a large standalone progress bar, four large queue statistic cards, or model/language/style configuration summary in the DevTools panel

## MODIFIED Requirements

### Requirement: 统计信息显示
DevTools 面板必须 (SHALL) 以精简方式显示媒体浏览所需的数量信息，且不得 (MUST NOT) 渲染独立的大型图片/视频统计汇总区块。

#### Scenario: 媒体数量精简显示
- **WHEN** DevTools 面板显示
- **THEN** 系统必须 (SHALL) 在媒体标签或等效紧凑控件中显示图片和视频数量
- **AND** 系统不得 (MUST NOT) 在独立统计区块中显示图片/视频的 captured、skipped、failed、size 明细

#### Scenario: 分类统计精简显示
- **WHEN** DevTools 面板显示分类队列状态
- **THEN** 系统必须 (SHALL) 在紧凑分类进度行中显示等待、处理中、已完成、失败数量
- **AND** 分类统计不得 (MUST NOT) 占用大型卡片网格布局

## REMOVED Requirements

### Requirement: DevTools opens dedicated settings page
**Reason**: The DevTools panel is being simplified into a media browsing surface, and the persistent Options migration prompt consumes space without belonging to the core browsing workflow.
**Migration**: Users SHALL open the extension Options page through Chrome's extension Options entrypoint, such as the browser extension icon context menu.

#### Scenario: Show settings entry point
- **WHEN** the DevTools panel renders
- **THEN** it SHALL show a visible action for opening extension settings
- **AND** the action SHALL open the extension Options page

#### Scenario: Settings action failure
- **WHEN** opening the extension Options page fails
- **THEN** the DevTools panel SHALL surface an error or fallback message to the user
