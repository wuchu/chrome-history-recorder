## Why

当前 sidepanel 的工具栏使用文字按钮，占用空间较大且视觉上不够简洁。将操作按钮转换为图标可以让界面更紧凑、更现代化，同时保持功能的可访问性。

## What Changes

- 将 StatusBar 中的"开始捕获/停止捕获"文字按钮替换为图标按钮
- 将 sidepanel-toolbar 中的"Settings"和"Clear Events"文字按钮替换为图标按钮
- 将所有三个图标按钮统一排列在 StatusBar 的右侧
- 为所有图标按钮添加 tooltip 提示，提高可访问性
- 简化 sidepanel-toolbar，移除已移至 StatusBar 的按钮
- 添加 `@ant-design/icons` 依赖

## Capabilities

### New Capabilities

- `icon-action-buttons`: 图标化操作按钮的交互和样式规范

### Modified Capabilities

- 无现有功能需求变更，仅 UI 样式调整

## Impact

- 受影响代码：`packages/extension/src/entrypoints/sidepanel/App.tsx`、`packages/extension/src/entrypoints/media-browser/components/StatusBar.tsx`、`packages/extension/src/entrypoints/sidepanel/sidepanel.css`、`packages/extension/src/entrypoints/media-browser/components/StatusBar.module.css`
- 新增依赖：`@ant-design/icons`
- 无 API 变更，纯 UI 调整
