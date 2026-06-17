# DevTools Media Grid

## Purpose

Provide the DevTools Panel media browsing experience: a thumbnail grid for captured media, real-time capture stream, history browsing, search/filter, focused media viewer, and aggregated service status. The panel reflects the active Extension Background + VFS Service architecture.

## Requirements


### Requirement: Scrollable tag tab bar
The DevTools Panel SHALL provide a scrollable tag tab bar above the media grid.

#### Scenario: Tab bar placement
- **WHEN** the DevTools Panel is displayed
- **THEN** the tag tab bar SHALL appear below the Classify Progress Section and above the media grid
- **AND** the tab bar SHALL replace the old MediaTabs (images/videos)

#### Scenario: Scroll functionality
- **WHEN** there are more tags than fit in the tab bar width
- **THEN** the tab bar SHALL support horizontal scrolling
- **AND** visual scroll indicators SHALL be provided

### Requirement: Tag display in media cards
The media grid SHALL NOT display tag text on thumbnail cards; tag-based filtering MAY remain available outside the card surface.

#### Scenario: Hide tags on card
- **WHEN** a media card is displayed in the primary masonry grid
- **THEN** the system SHALL show the media thumbnail only
- **AND** the system SHALL NOT show system tag chips or user tag chips on the card

### Requirement: DevTools opens dedicated settings page
The DevTools panel SHALL provide access to the dedicated extension Options page instead of embedding full program configuration forms.

#### Scenario: Show settings entry point
- **WHEN** the DevTools panel renders
- **THEN** it SHALL show a visible action for opening extension settings
- **AND** the action SHALL open the extension Options page

#### Scenario: Settings action failure
- **WHEN** opening the extension Options page fails
- **THEN** the DevTools panel SHALL surface an error or fallback message to the user

### Requirement: 缩略图网格布局
DevTools 面板必须 (SHALL) 以纯缩略图网格形式展示捕获的媒体。

#### Scenario: 网格布局展示
- **WHEN** 用户打开 DevTools 面板
- **THEN** 系统必须 (SHALL) 以网格形式展示媒体缩略图
- **AND** 网格必须 (SHALL) 使用 CSS Grid、Flexbox 或虚拟化 Masonry 布局
- **AND** 网格间距应该 (SHOULD) 为 4-10px

#### Scenario: 缩略图卡片结构
- **WHEN** 显示单个媒体项
- **THEN** 系统必须 (SHALL) 显示可点击的缩略图区域
- **AND** 系统必须 (SHALL) 在缩略图加载中或加载失败时显示轻量占位状态
- **AND** 系统禁止 (MUST NOT) 在主网格卡片上显示分类、AI 文件名、置信度、文件大小、类型信息或标签文本

#### Scenario: 缩略图尺寸
- **WHEN** 显示缩略图网格
- **THEN** 系统必须 (SHALL) 显示适当尺寸的缩略图
- **AND** 缩略图宽度应该 (SHOULD) 与当前网格列宽匹配
- **AND** 缩略图高度应该 (SHOULD) 保持宽高比例

#### Scenario: 响应式网格
- **WHEN** DevTools 面板宽度变化
- **THEN** 系统必须 (SHALL) 自动调整网格列数
- **AND** 系统必须 (SHALL) 保持缩略图尺寸相对固定

### Requirement: 实时捕获流
DevTools 面板必须 (SHALL) 显示实时捕获流。

#### Scenario: 实时流区域
- **WHEN** DevTools 面板显示
- **THEN** 系统必须 (SHALL) 在顶部显示实时捕获流区域
- **AND** 该区域必须 (SHALL) 显示最近捕获的媒体（最多 10 个）

#### Scenario: 新捕获动画
- **WHEN** 新文件被捕获
- **THEN** 系统必须 (SHALL) 将新缩略图添加到流头部
- **AND** 系统应该 (SHOULD) 使用动画效果显示新项
- **AND** 旧项应该 (SHOULD) 逐渐移出流区域

#### Scenario: 捕获流状态更新
- **WHEN** 收到 WebSocket 分类状态事件
- **THEN** 系统必须 (SHALL) 实时更新对应缩略图的状态图标
- **AND** 系统必须 (SHALL) 显示分类进度动画（如分类中）

#### Scenario: 状态图标颜色
- **WHEN** 显示分类状态图标
- **THEN** 系统必须 (SHALL) 使用颜色区分状态：
  - ✓ 已分类：绿色
  - ◉ 分类中：蓝色/动画
  - ○ 等待：灰色
  - ✗ 失败：红色

### Requirement: 历史分类结果网格
DevTools 面板必须 (SHALL) 提供历史媒体浏览，并以纯缩略图网格展示历史结果。

#### Scenario: 历史结果 Tab
- **WHEN** 用户查看历史媒体区域
- **THEN** 系统必须 (SHALL) 展示历史媒体缩略图网格
- **AND** 网格必须 (SHALL) 显示符合当前过滤条件的媒体

#### Scenario: 分页加载
- **WHEN** 历史结果数量较多
- **THEN** 系统必须 (SHALL) 分页加载结果
- **AND** 每页应该 (SHOULD) 显示 20-50 项
- **AND** 系统必须 (SHALL) 提供继续加载能力

#### Scenario: 分类信息不显示在网格卡片
- **WHEN** 显示已分类的历史媒体缩略图
- **THEN** 系统必须 (SHALL) 只在卡片上显示缩略图和加载状态
- **AND** 系统禁止 (MUST NOT) 在卡片底部显示分类后的文件名、分类目录名称、置信度百分比、文件大小或类型

#### Scenario: 置信度不在网格可视化
- **WHEN** 显示历史媒体缩略图
- **THEN** 系统禁止 (MUST NOT) 在主网格卡片中显示置信度进度条或置信度颜色编码

### Requirement: 搜索和过滤
DevTools 面板必须 (SHALL) 提供搜索和过滤功能。

#### Scenario: 搜索输入框
- **WHEN** 用户在搜索框输入关键词
- **THEN** 系统必须 (SHALL) 实时过滤显示匹配的媒体
- **AND** 系统必须 (SHALL) 搜索文件名和分类名称

#### Scenario: 分类过滤下拉
- **WHEN** 用户选择分类过滤选项
- **THEN** 系统必须 (SHALL) 仅显示该分类的媒体
- **AND** 过滤选项必须 (SHALL) 包含动态获取的分类列表

#### Scenario: 类型过滤下拉
- **WHEN** 用户选择类型过滤选项
- **THEN** 系统必须 (SHALL) 仅显示该类型的媒体
- **AND** 过滤选项必须 (SHALL) 包含：全部、图片、视频

#### Scenario: 日期过滤下拉
- **WHEN** 用户选择日期过滤选项
- **THEN** 系统必须 (SHALL) 仅显示该日期捕获的媒体
- **AND** 过滤选项必须 (SHALL) 包含：今天、昨天、本周、本月、全部

#### Scenario: 排序选项
- **WHEN** 用户选择排序选项
- **THEN** 系统必须 (SHALL) 按指定顺序排列媒体
- **AND** 排序选项必须 (SHALL) 包含：最新、最旧、置信度最高、置信度最低

### Requirement: Media details panel
The DevTools Panel SHALL provide a focused media viewer that opens from a thumbnail and prioritizes viewing the local VFS-backed original image.

#### Scenario: 点击缩略图打开查看器
- **WHEN** 用户点击缩略图
- **THEN** 系统必须 (SHALL) 打开媒体查看器
- **AND** 查看器必须 (SHALL) 显示为弹出层或覆盖层

#### Scenario: 本地 VFS 原图预览
- **WHEN** 图片查看器打开
- **THEN** 系统必须 (SHALL) 使用媒体 hash 构建本地 VFS 原图 URL
- **AND** 图片 URL 必须 (SHALL) 指向 `GET /files/:hash`
- **AND** 系统禁止 (MUST NOT) 优先使用或回退到原始页面的 source URL 作为查看器图片源

#### Scenario: 大图查看体验
- **WHEN** 图片查看器打开
- **THEN** 系统必须 (SHALL) 将图片作为主要视觉内容显示
- **AND** 图片必须 (SHALL) 在可用视口内按比例完整显示
- **AND** 元数据内容禁止 (MUST NOT) 与大图争抢主要显示区域

#### Scenario: 查看器标题
- **WHEN** 图片查看器打开
- **THEN** 查看器必须 (SHALL) 在左上角显示图片标题
- **AND** 标题必须 (SHALL) 优先显示 AI 重命名后的文件名
- **AND** 没有重命名文件名时必须 (SHALL) 显示媒体 hash

#### Scenario: 视频预览不可用
- **WHEN** 查看器打开的媒体不是图片
- **THEN** 系统必须 (SHALL) 显示视频预览不可用状态
- **AND** 系统禁止 (MUST NOT) 尝试用图片查看器加载视频源

#### Scenario: 查看器操作按钮
- **WHEN** 查看器显示
- **THEN** 系统必须 (SHALL) 提供关闭操作
- **AND** 系统禁止 (MUST NOT) 在原图查看器工具栏显示下载操作
- **AND** 系统禁止 (MUST NOT) 在原图查看器工具栏显示旋转或重新分类/重命名图标操作

#### Scenario: 关闭查看器
- **WHEN** 用户点击关闭按钮、点击查看器背景或按 Escape 键
- **THEN** 系统必须 (SHALL) 关闭查看器
- **AND** 系统必须 (SHALL) 返回网格视图

### Requirement: 分类进度控制区
DevTools 面板必须 (SHALL) 在分类进度区域提供队列和调度器控制。

#### Scenario: 显示开始和暂停控制
- **WHEN** 分类进度区域显示
- **THEN** 系统必须 (SHALL) 显示当前分类处理状态
- **AND** 系统必须 (SHALL) 提供开始或暂停按钮

#### Scenario: 显示队列维护控制
- **WHEN** 分类进度区域显示
- **THEN** 系统必须 (SHALL) 提供重试失败任务和清空队列操作
- **AND** 操作完成后必须 (SHALL) 刷新队列统计

### Requirement: 历史图片加载消息协议兼容
DevTools 面板必须 (SHALL) 使用正确的消息协议加载历史图片。

#### Scenario: 发送正确消息类型
- **WHEN** useHistoricalImages hook 加载历史图片
- **THEN** 系统必须 (SHALL) 发送消息类型为 'listFiles'（camelCase）
- **AND** 禁止使用 (MUST NOT) 'list-files'（kebab-case）

#### Scenario: 正确包装查询参数
- **WHEN** 发送加载历史图片请求
- **THEN** 系统必须 (SHALL) 将分页和过滤参数包装在 `query` 对象中
- **AND** 消息格式必须 (SHALL) 为 `{ type: 'listFiles', query: { limit, offset, type } }`

#### Scenario: 处理标准响应格式
- **WHEN** Background 返回 listFiles 响应
- **THEN** DevTools 必须 (SHALL) 检查响应的 `success` 字段
- **AND** 成功时必须 (SHALL) 从 `data` 字段读取文件列表
- **AND** 失败时必须 (SHALL) 显示 `error` 字段中的错误信息

### Requirement: 服务状态联动显示
DevTools 面板必须 (SHALL) 根据 VFS 和 Ollama 服务状态联动更新界面。

#### Scenario: VFS 断开时显示提示
- **WHEN** VFS WebSocket 连接断开
- **THEN** DevTools 必须 (SHALL) 显示 VFS 未连接状态
- **AND** 历史图片区域必须 (SHALL) 显示可操作的连接提示

#### Scenario: Ollama 不可用时保持浏览可用
- **WHEN** Ollama 服务不可用但 VFS 可用
- **THEN** DevTools 必须 (SHALL) 保持媒体浏览和历史图片加载可用
- **AND** AI 分类控制必须 (SHALL) 显示 Ollama 不可用提示

#### Scenario: 服务恢复时刷新状态
- **WHEN** VFS 或 Ollama 服务状态恢复可用
- **THEN** DevTools 必须 (SHALL) 更新状态显示
- **AND** 相关的重试、分类或历史加载操作应该 (SHOULD) 重新可用

### Requirement: 统计信息显示
DevTools 面板必须 (SHALL) 显示统计信息。

#### Scenario: 今日统计
- **WHEN** DevTools 面板显示
- **THEN** 系统必须 (SHALL) 显示今日捕获统计
- **AND** 统计必须 (SHALL) 包含：捕获数量、总大小

#### Scenario: 本周统计
- **WHEN** DevTools 面板显示
- **THEN** 系统必须 (SHALL) 显示本周捕获统计
- **AND** 统计应该 (SHOULD) 以缩略形式显示（如 "本周 1.2k"）

#### Scenario: 分类统计
- **WHEN** DevTools 面板显示
- **THEN** 系统必须 (SHALL) 显示分类统计
- **AND** 统计必须 (SHALL) 包含：已分类数量、等待数量、失败数量

### Requirement: 服务状态聚合
DevTools 面板必须 (SHALL) 显示当前 Extension/VFS 架构下的服务状态。

#### Scenario: 显示 VFS 状态
- **WHEN** DevTools 面板显示
- **THEN** 系统必须 (SHALL) 显示 VFS Service 或 VFS WebSocket 连接状态
- **AND** 状态必须 (SHALL) 使用统一尺寸的状态圆点和文字

#### Scenario: 显示 Ollama 状态
- **WHEN** DevTools 面板显示
- **THEN** 系统必须 (SHALL) 显示 Ollama 服务可用状态
- **AND** 状态必须 (SHALL) 使用与其他连接状态一致尺寸的状态圆点
- **AND** 不可用时必须 (SHALL) 提供可操作的检查或重试提示

#### Scenario: 显示 AI 分类状态
- **WHEN** 分类队列状态可用
- **THEN** 系统必须 (SHALL) 显示 AI 分类运行中或暂停状态
- **AND** 状态必须 (SHALL) 包含当前队列处理数量

#### Scenario: 状态图标聚合
- **WHEN** 多个服务状态显示
- **THEN** 系统必须 (SHALL) 在状态栏聚合显示当前可用性
- **AND** 连接状态圆点大小必须 (SHALL) 保持统一

### Requirement: NetworkListener 监听器管理
NetworkListener 必须 (SHALL) 正确管理 Chrome DevTools 网络请求监听器的注册和移除。

#### Scenario: 监听器正确注册
- **WHEN** `startListening()` 被调用
- **THEN** 系统必须 (SHALL) 使用相同的函数引用注册监听器
- **AND** 系统必须 (SHALL) 缓存绑定后的函数引用

#### Scenario: 监听器正确移除
- **WHEN** `stopListening()` 被调用
- **THEN** 系统必须 (SHALL) 使用相同的函数引用移除监听器
- **AND** 监听器 必须 (SHALL) 被完全移除

#### Scenario: React StrictMode 兼容
- **WHEN** 组件经历多次挂载/卸载（React StrictMode）
- **THEN** 系统必须 (SHALL) 每次正确移除监听器
- **AND** 系统必须 (SHALL) 不残留监听器

### Requirement: DevTools media grid superseded by Side Panel
The DevTools media grid SHALL no longer be the primary supported media capture and browsing surface after the Side Panel migration.

#### Scenario: Primary media browser location
- **WHEN** the user opens the extension for media capture or browsing
- **THEN** the system SHALL present the Side Panel media browser as the primary UI
- **AND** documentation SHALL NOT require opening Chrome DevTools to use the recorder

#### Scenario: Temporary DevTools compatibility
- **WHEN** DevTools media grid code remains during migration
- **THEN** it SHALL be treated as a temporary fallback or debugging surface
- **AND** new primary media browser requirements SHALL be defined by `side-panel-media-browser`

### Requirement: DevTools-specific network capture retired
The DevTools media grid SHALL NOT own image interception after migration to Side Panel capture.

#### Scenario: Capture toggle behavior
- **WHEN** the user starts capture from the supported UI
- **THEN** the request SHALL be handled by Background tab-scoped capture state
- **AND** the system SHALL NOT depend on `chrome.devtools.network.onRequestFinished` for primary capture

### Requirement: DevTools media grid superseded by Side Panel
The DevTools media grid SHALL no longer be the primary supported media capture and browsing surface after the Side Panel migration.

#### Scenario: Primary media browser location
- **WHEN** the user opens the extension for media capture or browsing
- **THEN** the system SHALL present the Side Panel media browser as the primary UI
- **AND** documentation SHALL NOT require opening Chrome DevTools to use the recorder

#### Scenario: Temporary DevTools compatibility
- **WHEN** DevTools media grid code remains during migration
- **THEN** it SHALL be treated as a temporary fallback or debugging surface
- **AND** new primary media browser requirements SHALL be defined by `side-panel-media-browser`

### Requirement: DevTools-specific network capture retired
The DevTools media grid SHALL NOT own image interception after migration to Side Panel capture.

#### Scenario: Capture toggle behavior
- **WHEN** the user starts capture from the supported UI
- **THEN** the request SHALL be handled by Background tab-scoped capture state
- **AND** the system SHALL NOT depend on `chrome.devtools.network.onRequestFinished` for primary capture

### Requirement: DevTools media grid superseded by Side Panel
The DevTools media grid SHALL no longer be the primary supported media capture and browsing surface after the Side Panel migration.

#### Scenario: Primary media browser location
- **WHEN** the user opens the extension for media capture or browsing
- **THEN** the system SHALL present the Side Panel media browser as the primary UI
- **AND** documentation SHALL NOT require opening Chrome DevTools to use the recorder

#### Scenario: Temporary DevTools compatibility
- **WHEN** DevTools media grid code remains during migration
- **THEN** it SHALL be treated as a temporary fallback or debugging surface
- **AND** new primary media browser requirements SHALL be defined by `side-panel-media-browser`

### Requirement: DevTools-specific network capture retired
The DevTools media grid SHALL NOT own image interception after migration to Side Panel capture.

#### Scenario: Capture toggle behavior
- **WHEN** the user starts capture from the supported UI
- **THEN** the request SHALL be handled by Background tab-scoped capture state
- **AND** the system SHALL NOT depend on `chrome.devtools.network.onRequestFinished` for primary capture

### Requirement: DevTools media grid superseded by Side Panel
The DevTools media grid SHALL no longer be the primary supported media capture and browsing surface after the Side Panel migration.

#### Scenario: Primary media browser location
- **WHEN** the user opens the extension for media capture or browsing
- **THEN** the system SHALL present the Side Panel media browser as the primary UI
- **AND** documentation SHALL NOT require opening Chrome DevTools to use the recorder

#### Scenario: Temporary DevTools compatibility
- **WHEN** DevTools media grid code remains during migration
- **THEN** it SHALL be treated as a temporary fallback or debugging surface
- **AND** new primary media browser requirements SHALL be defined by `side-panel-media-browser`

### Requirement: DevTools-specific network capture retired
The DevTools media grid SHALL NOT own image interception after migration to Side Panel capture.

#### Scenario: Capture toggle behavior
- **WHEN** the user starts capture from the supported UI
- **THEN** the request SHALL be handled by Background tab-scoped capture state
- **AND** the system SHALL NOT depend on `chrome.devtools.network.onRequestFinished` for primary capture
