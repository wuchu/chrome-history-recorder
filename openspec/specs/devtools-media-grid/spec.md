## ADDED Requirements

### Requirement: 缩略图网格布局
DevTools 面板必须 (SHALL) 以缩略图网格形式展示捕获的媒体。

#### Scenario: 网格布局展示
- **WHEN** 用户打开 DevTools 面板
- **THEN** 系统必须 (SHALL) 以网格形式展示媒体缩略图
- **AND** 网格必须 (SHALL) 使用 CSS Grid 或 Flexbox 布局
- **AND** 网格间距应该 (SHOULD) 为 4-8px

#### Scenario: 缩略图卡片结构
- **WHEN** 显示单个媒体项
- **THEN** 系统必须 (SHALL) 显示包含以下内容的卡片：
  - 缩略图图片区域
  - 分类状态图标（✓ 已分类 / ◉ 分类中 / ○ 等待 / ✗ 失败）
  - 简短文件名（截断显示）
  - 分类名称和置信度（如已分类）
  - 文件大小和类型信息

#### Scenario: 缩略图尺寸
- **WHEN** 显示缩略图网格
- **THEN** 系统必须 (SHALL) 显示适当尺寸的缩略图
- **AND** 缩略图宽度应该 (SHOULD) 为 100-120px
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
DevTools 面板必须 (SHALL) 提供历史分类结果浏览。

#### Scenario: 历史结果 Tab
- **WHEN** 用户点击"历史分类结果"区域
- **THEN** 系统必须 (SHALL) 展示历史分类结果网格
- **AND** 网格必须 (SHALL) 显示所有已分类的媒体

#### Scenario: 分页加载
- **WHEN** 历史结果数量较多
- **THEN** 系统必须 (SHALL) 分页加载结果
- **AND** 每页应该 (SHOULD) 显示 20-50 项
- **AND** 系统必须 (SHALL) 提供"加载更多"按钮

#### Scenario: 分类信息显示
- **WHEN** 显示已分类的缩略图
- **THEN** 系统必须 (SHALL) 在卡片底部显示：
  - 分类后的文件名
  - 分类目录名称
  - 置信度百分比
  - 文件大小和类型

#### Scenario: 置信度可视化
- **WHEN** 显示置信度
- **THEN** 系统必须 (SHALL) 使用进度条或颜色表示置信度
- **AND** 高置信度（>90%）应该 (SHOULD) 使用绿色
- **AND** 中置信度（70-90%）应该 (SHOULD) 使用黄色
- **AND** 低置信度（<70%）应该 (SHOULD) 使用红色

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

### Requirement: 媒体详情面板
DevTools 面板必须 (SHALL) 提供媒体详情查看面板。

#### Scenario: 点击缩略图打开详情
- **WHEN** 用户点击缩略图
- **THEN** 系统必须 (SHALL) 打开详情面板
- **AND** 详情面板必须 (SHALL) 显示在右侧或弹出层

#### Scenario: 大图预览
- **WHEN** 详情面板打开
- **THEN** 系统必须 (SHALL) 显示媒体的大图预览
- **AND** 图片必须 (SHALL) 使用较高分辨率（如 400px 宽度）
- **AND** 视频必须 (SHALL) 提供播放控件（如支持）

#### Scenario: 分类结果详情
- **WHEN** 媒体已分类
- **THEN** 系统必须 (SHALL) 显示详细分类信息：
  - Category: 分类名称
  - Filename: 新文件名
  - Confidence: 置信度进度条
  - Tags: 标签列表

#### Scenario: 文件信息详情
- **WHEN** 详情面板显示
- **THEN** 系统必须 (SHALL) 显示文件元信息：
  - Hash: 文件哈希值
  - Size: 文件大小（带单位）
  - Type: MIME 类型
  - Captured: 捕获时间

#### Scenario: 来源信息
- **WHEN** 详情面板显示
- **THEN** 系统必须 (SHALL) 显示来源信息：
  - URL: 来源 URL（可点击跳转）
  - Page: 查看原页面链接

#### Scenario: 操作按钮
- **WHEN** 详情面板显示
- **THEN** 系统必须 (SHALL) 提供操作按钮：
  - 重新分类：触发重新分类
  - 删除：删除该文件
  - 导出：下载文件
  - 复制文件名：复制新文件名到剪贴板

#### Scenario: 关闭详情面板
- **WHEN** 用户点击关闭按钮
- **THEN** 系统必须 (SHALL) 关闭详情面板
- **AND** 系统必须 (SHALL) 返回网格视图

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