## Context

当前 sidepanel 的 UI 布局分为两个区域：
1. **StatusBar**：顶部状态栏，包含服务状态指示器和"开始捕获/停止捕获"文字按钮
2. **sidepanel-toolbar**：状态栏下方，包含 Tab 信息、捕获计数、"Settings"和"Clear Events"文字按钮

项目已使用 Ant Design 组件库，但尚未引入 `@ant-design/icons`。

## Goals / Non-Goals

**Goals:**
- 将三个操作按钮（捕获、清空事件、设置）转换为图标按钮
- 统一将所有图标按钮放置在 StatusBar 右侧
- 使用 Ant Design Tooltip 提供可访问性提示
- 保持现有功能完全不变

**Non-Goals:**
- 不改变按钮的功能逻辑
- 不修改 StatusBar 左侧的状态指示器
- 不引入新的依赖除了 `@ant-design/icons`

## Decisions

### Decision 1: 使用 @ant-design/icons
**选择**: 使用 Ant Design 官方图标库 `@ant-design/icons`

**替代方案**:
- 使用 Lucide React（现代但会增加新的非 Ant Design 依赖）
- 使用自定义 SVG（维护成本高）

**理由**: 项目已使用 Ant Design，保持图标库一致性更合理，减少认知负担。

### Decision 2: 图标选择
**选择**:
- 开始捕获: `PlayCircleOutlined`
- 停止捕获: `PauseCircleOutlined`
- 清空事件: `ClearOutlined`
- 设置: `SettingOutlined`

**替代方案**:
- 使用 filled 版本（视觉上过重）
- 使用更简化的线性图标（Ant Design 的 outlined 风格更符合项目）

**理由**: 这些图标语义清晰，符合用户认知习惯。

### Decision 3: 按钮布局
**选择**: 将所有三个图标按钮统一放在 StatusBar 右侧区域

**替代方案**:
- 在 sidepanel 最右上角创建固定区域（需要重构更多布局）
- 保持分散在两个区域（不符合用户需求）

**理由**: 集中放置操作按钮，让用户更容易发现和使用。

### Decision 4: 使用 Ant Design Tooltip
**选择**: 使用 Ant Design 的 `Tooltip` 组件包裹每个图标按钮

**替代方案**:
- 自定义实现 tooltip（增加复杂度）
- 不使用 tooltip（可访问性下降）

**理由**: Ant Design Tooltip 已经国际化友好，且与项目组件风格一致。

## Risks / Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| 图标语义不清晰 | Low | Medium | 使用 tooltip 补充文字说明 |
| 按钮在小尺寸面板下拥挤 | Medium | Low | 保持合理间距，使用 16px-18px 图标尺寸 |
| sidepanel-toolbar 简化后可能太单调 | Low | Low | 保留有用信息（Tab、计数） |

## Architecture

### 组件变更概览

```
StatusBar.tsx (修改)
├── 左侧：现有状态指示器（不变）
└── 右侧：三个图标按钮区域（新增）
    ├── [▶/⏸] 捕获按钮
    ├── [🗑] 清空事件按钮
    └── [⚙] 设置按钮

App.tsx (修改)
├── 回调函数传递给 StatusBar
└── sidepanel-toolbar 简化（移除 Settings 和 Clear Events 按钮）

sidepanel.css (修改)
└── sidepanel-toolbar 样式微调

StatusBar.module.css (修改)
└── 新增右侧图标按钮区域样式
```

### 数据流

```
App.tsx
├── handleOpenOptions (传递给 StatusBar)
├── handleClearEvents (传递给 StatusBar)
└── onToggleCapture (已传递，保持不变)
    ↓
StatusBar.tsx (接收并绑定到图标按钮)
```

## Open Questions

无
