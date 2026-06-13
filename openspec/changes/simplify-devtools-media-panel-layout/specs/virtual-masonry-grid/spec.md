## MODIFIED Requirements

### Requirement: 无限滚动

- **REQ-2.1**: 页面/body 滚动接近底部时触发加载更多回调
- **REQ-2.2**: 回调执行 `GET /images?limit=50&offset={currentOffset+50}` 或等效的后台媒体分页请求
- **REQ-2.3**: 新数据追加到现有列表末尾
- **REQ-2.4**: `hasMore === false` 时停止加载
- **REQ-2.5**: 媒体网格不得 (MUST NOT) 依赖固定高度的内部垂直滚动容器来触发加载更多

#### Scenario: Body scroll triggers load more
- **WHEN** the user scrolls the DevTools panel page near the document bottom and `hasMore` is true
- **THEN** the virtual masonry grid SHALL trigger `onLoadMore`
- **AND** the next page of media SHALL append to the grid

#### Scenario: No fixed internal scrollbar required
- **WHEN** the virtual masonry grid renders
- **THEN** it SHALL NOT require a fixed-height internal vertical scroll container for normal browsing
- **AND** loading and end-of-list indicators SHALL render in normal document flow

### Requirement: 分类进度 Section

- **REQ-8.1**: 显示紧凑的全局分类状态行
- **REQ-8.2**: 显示队列统计: pending, processing, completed, failed
- **REQ-8.3**: 实时更新分类队列状态
- **REQ-8.4**: 显示开始/暂停、重试失败、清空队列等可用操作
- **REQ-8.5**: 不得 (MUST NOT) 在 DevTools 面板显示大型进度条、四个大型统计卡片或分类配置摘要

#### Scenario: Compact classification progress section
- **WHEN** classification queue status is available
- **THEN** the component SHALL show scheduler state, queue counts, and available queue actions in one compact row
- **AND** the component SHALL avoid large dashboard-style progress and configuration display

#### Scenario: Queue actions remain available
- **WHEN** the user starts, pauses, retries failed tasks, or clears the queue from the compact row
- **THEN** the component SHALL invoke the existing queue action callbacks without changing background queue semantics
