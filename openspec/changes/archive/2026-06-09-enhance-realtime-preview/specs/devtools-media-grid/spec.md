## ADDED Requirements

### Requirement: 实时捕获流组件
Extension 必须 (SHALL) 提供实时捕获流组件展示最新捕获的媒体。

#### Scenario: 显示最新捕获
- **WHEN** 新文件被捕获
- **THEN** CaptureStream 组件必须 (SHALL) 显示最新的 10 个媒体
- **AND** 组件必须 (SHALL) 使用缩略图展示
- **AND** 新捕获的项 应该 (SHOULD) 有动画效果

#### Scenario: 分类状态指示
- **WHEN** 媒体正在分类或分类完成
- **THEN** 组件必须 (SHALL) 显示分类状态图标
- **AND** 状态 必须 (SHALL) 包括：等待分类、分类中、已完成、失败

#### Scenario: 点击跳转
- **WHEN** 用户点击捕获流中的媒体
- **THEN** 组件 必须 (SHALL) 切换到历史结果 tab
- **AND** 组件 必须 (SHALL) 高亮选中的媒体项

### Requirement: 媒体网格组件
Extension 必须 (SHALL) 提供网格布局展示历史媒体。

#### Scenario: 网格布局
- **WHEN** 显示历史媒体列表
- **THEN** MediaGrid 组件 必须 (SHALL) 使用 CSS Grid 布局
- **AND** 每个项 必须 (SHALL) 显示缩略图和基本信息
- **AND** 网格列数 应该 (SHOULD) 自适应屏幕宽度

#### Scenario: 媒体项信息显示
- **WHEN** 显示单个媒体项
- **THEN** MediaItem 必须 (SHALL) 显示：
  - 缩略图（80x80）
  - 分类信息（如果有）
  - 置信度可视化（如果有）
  - 捕获时间

#### Scenario: 分类信息显示
- **WHEN** 媒体已分类
- **THEN** MediaItem 必须 (SHALL) 显示分类类别
- **AND** MediaItem 应该 (SHOULD) 显示置信度百分比
- **AND** MediaItem 应该 (SHOULD) 显示标签列表

### Requirement: 状态栏增强
Extension 必须 (SHALL) 在状态栏显示实时连接和分类状态。

#### Scenario: WebSocket 连接状态
- **WHEN** WebSocket 连接状态变化
- **THEN** StatusBar 必须 (SHALL) 显示连接图标
- **AND** 状态 必须 (SHALL) 使用颜色区分：绿色=已连接、红色=断开、黄色=重连中

#### Scenario: 分类队列状态
- **WHEN** 有文件正在分类
- **THEN** StatusBar 应该 (SHOULD) 显示分类进度
- **AND** StatusBar 应该 (SHOULD) 显示队列数量

#### Scenario: AI Classify 插件状态
- **WHEN** AI Classify 插件可用
- **THEN** StatusBar 应该 (SHOULD) 显示插件状态图标
- **AND** StatusBar 应该 (SHOULD) 显示已分类文件数量