## Why

当前 side panel 的 header 区域占用垂直空间较多，状态栏和工具栏分两行显示，且文案较长。需要让布局更紧凑，为内容区域留出更多空间。

## What Changes

- 精简 StatusBar 文案："服务已连接" → "服务"，"VFS 已连接" → "VFS"，"Ollama 可用" → "Ollama"
- 移除 sidepanel-toolbar，将捕获统计信息整合到 StatusBar
- 捕获/错误计数改用图标表示：✅N（成功）、❌N（失败）
- 用竖线 | 分割不同信息区域
- 移除 Tab ID 显示
- 错误信息改用 Tooltip 显示
- 整体压缩 header 高度

## Capabilities

### New Capabilities

### Modified Capabilities

- `side-panel-media-browser`: 调整 header 布局，使状态栏更紧凑

## Impact

- `packages/extension/src/entrypoints/media-browser/components/StatusBar.tsx` - 重构组件
- `packages/extension/src/entrypoints/media-browser/components/StatusBar.module.css` - 调整样式
- `packages/extension/src/entrypoints/sidepanel/App.tsx` - 移除 sidepanel-toolbar，传递新 props
- `packages/extension/src/entrypoints/sidepanel/sidepanel.css` - 移除 sidepanel-toolbar 样式
