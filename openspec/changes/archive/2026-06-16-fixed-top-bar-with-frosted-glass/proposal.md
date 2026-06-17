## Why

当前 side panel 布局中，顶部导航区域（包括状态栏、工具栏、分类进度和标签栏）会随内容一起滚动，导致用户在浏览大量媒体文件时无法快速切换标签或控制捕获。同时，页面可能出现横向滚动条，影响体验。

## What Changes

- 将顶部 tab bar 及以上所有组件使用 `position: fixed` 固定在视口顶部
- 为固定区域添加毛玻璃背景效果（`backdrop-filter: blur`）
- 为下方内容区域添加足够的顶部 padding，避免被固定区域遮挡
- 在全局样式中禁止横向滚动条

## Capabilities

### New Capabilities

（无新功能，这是纯 UI 样式改进）

### Modified Capabilities

- `side-panel-media-browser`: 更新布局样式，顶部区域固定并添加毛玻璃效果

## Impact

- 受影响文件：
  - `packages/extension/src/entrypoints/sidepanel/App.tsx`
  - `packages/extension/src/entrypoints/media-browser/App.module.css`
  - `packages/extension/src/entrypoints/sidepanel/sidepanel.css`
