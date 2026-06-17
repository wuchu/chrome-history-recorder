## MODIFIED Requirements

### Requirement: Tag display in media cards
The media grid SHALL NOT display tag text on thumbnail cards; tag-based filtering MAY remain available outside the card surface.

#### Scenario: Hide tags on card
- **WHEN** a media card is displayed in the primary masonry grid
- **THEN** the system SHALL show the media thumbnail only
- **AND** the system SHALL NOT show system tag chips or user tag chips on the card

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

#### Scenario: 视频预览不可用
- **WHEN** 查看器打开的媒体不是图片
- **THEN** 系统必须 (SHALL) 显示视频预览不可用状态
- **AND** 系统禁止 (MUST NOT) 尝试用图片查看器加载视频源

#### Scenario: 查看器操作按钮
- **WHEN** 查看器显示
- **THEN** 系统必须 (SHALL) 提供关闭操作
- **AND** 系统必须 (SHALL) 提供下载本地 VFS 原图的操作
- **AND** 当调用方提供重新分类能力时，系统必须 (SHALL) 提供重新分类/重命名操作

#### Scenario: 重新分类操作反馈
- **WHEN** 用户点击查看器中的重新分类/重命名按钮
- **THEN** 系统必须 (SHALL) 将该媒体 hash 发送给 Background 重新入队
- **AND** 操作进行中必须 (SHALL) 禁用重复提交

#### Scenario: 关闭查看器
- **WHEN** 用户点击关闭按钮、点击查看器背景或按 Escape 键
- **THEN** 系统必须 (SHALL) 关闭查看器
- **AND** 系统必须 (SHALL) 返回网格视图

## REMOVED Requirements

### Requirement: 媒体卡片快速操作

**Reason**: The primary media grid is now a thumbnail-only browsing surface. Hover quick actions add visual noise and conflict with the focused thumbnail browsing requirement.

**Migration**: Requeue classification/renaming remains available from the media viewer after the user opens a thumbnail.
