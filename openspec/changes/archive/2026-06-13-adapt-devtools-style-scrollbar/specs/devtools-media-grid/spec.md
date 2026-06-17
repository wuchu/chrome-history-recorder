## MODIFIED Requirements

### Requirement: 缩略图网格布局
DevTools 面板必须 (SHALL) 以缩略图网格形式展示捕获的媒体。

#### Scenario: 网格布局展示
- **WHEN** 用户打开 DevTools 面板
- **THEN** 系统必须 (SHALL) 以网格形式展示媒体缩略图
- **AND** 网格必须 (SHALL) 使用 CSS Grid 或 Flexbox 布局
- **AND** 网格间距应该 (SHOULD) 为 4-8px
- **AND** 滚动区域必须 (SHALL) 使用 Chrome DevTools 风格的自定义滚动条

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
- **AND** 系统必须 (SHOULD) 保持缩略图尺寸相对固定
