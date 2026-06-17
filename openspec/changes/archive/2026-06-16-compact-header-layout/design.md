## Context

当前 Side Panel 的 header 布局分为两行：
- 第一行：StatusBar（服务/VFS/Ollama 状态、分类状态、操作按钮）
- 第二行：sidepanel-toolbar（Tab ID、捕获计数、错误信息）

这种布局占用较多垂直空间，需要更紧凑的设计。

## Goals / Non-Goals

**Goals:**
- 压缩 header 垂直高度，为内容区域留出更多空间
- 保持所有状态信息可见
- 使用图标和精简文案提升信息密度

**Non-Goals:**
- 不修改功能逻辑，只调整 UI 布局
- 不添加新功能

## Decisions

### 决策1：状态文案精简
- **选项**：完整文案 vs 精简文案
- **选择**：精简文案
- **理由**："服务"、"VFS"、"Ollama" 配合颜色状态点已足够表达
- **实现**：修改 StatusBar 组件文案

### 决策2：捕获计数用图标表示
- **选项**：文字 "Captured 5 / Failed 0" vs 图标 "✅5 ❌0"
- **选择**：图标方式
- **理由**：更紧凑，视觉上更清晰
- **实现**：使用 ✅ 和 ❌ emoji 图标

### 决策3：移除 Tab ID 显示
- **选项**：保留 vs 移除
- **选择**：移除
- **理由**：用户明确要求，节省空间
- **实现**：sidepanel/App.tsx 中不传递 Tab ID

### 决策4：错误信息用 Tooltip
- **选项**：直接显示文字 vs Tooltip
- **选择**：Tooltip
- **理由**：错误不常发生，用 Tooltip 节省空间
- **实现**：给 ❌ 图标添加 Tooltip，hover 时显示详细错误

### 决策5：用竖线分割区域
- **选项**：空格分割 vs 竖线分割
- **选择**：竖线 `|`
- **理由**：视觉上更清晰地区分不同信息区域
- **布局**：`[服务状态] | [捕获统计] | [分类状态] [操作按钮]`

### 决策6：StatusBar 新增 Props
- **新增 props**：
  - `captureCount?: number` - 成功捕获数量
  - `failedCount?: number` - 失败数量
  - `captureError?: string` - 错误信息
- **理由**：将捕获信息从 sidepanel-toolbar 移到 StatusBar

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 信息过于紧凑导致可读性下降 | 中 | 保持适当间距，用竖线清晰分隔 |
| 错误信息被隐藏用户注意不到 | 低 | 错误时给 ❌ 图标添加醒目的颜色/样式 |
| 小屏幕空间不足 | 低 | 使用 flex 布局，允许适当换行或滚动 |

## Open Questions

无
