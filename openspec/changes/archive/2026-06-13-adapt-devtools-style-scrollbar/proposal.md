## Why

当前项目的滚动条使用浏览器默认样式，与 Chrome DevTools 原生面板的精致风格不协调。特别是 ScrollableTabBar 组件完全隐藏了滚动条，用户无法直观地知道还有更多标签可以查看。适配 Chrome DevTools 风格的滚动条将提升整体 UI 的一致性和用户体验。

## What Changes

- 为 devtools-panel 添加全局 Chrome DevTools 风格的滚动条样式
- 适配明暗双主题的滚动条配色
- 修改 ScrollableTabBar，从隐藏滚动条改为显示精致的 DevTools 风格滚动条
- 确保所有可滚动区域（MediaGrid、MediaDetail 等）使用统一的滚动条样式

## Capabilities

### New Capabilities

### Modified Capabilities
- `devtools-media-grid`: 优化滚动条样式以匹配 DevTools 风格
- `dark-mode-support`: 确保滚动条在暗色主题下有正确的配色

## Impact

- 受影响的文件主要是 `packages/extension/src/entrypoints/devtools-panel/` 下的 CSS 模块文件
- 无破坏性变更，仅涉及 UI 样式调整
- 不依赖新的第三方库
