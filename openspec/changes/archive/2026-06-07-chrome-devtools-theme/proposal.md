## Why

当前 DevTools 面板的样式与原生 Chrome DevTools 风格不一致，存在以下问题：

1. **视觉风格不协调**：面板使用了自定义的颜色方案，与 Chrome DevTools 原生深色/浅色主题差异明显，用户在使用时会感到割裂感
2. **body 边距留白问题**：面板存在 `padding: 16px`，导致在 DevTools 面板中显示时出现不必要的边距和留白，浪费空间
3. **字体风格不统一**：使用 `system-ui` 而非 Chrome DevTools 原生的字体栈

作为 Chrome DevTools 集成面板，应该无缝融入原生 DevTools 的视觉体验，让用户感觉这是 Chrome 内置功能而非第三方扩展。

## What Changes

- 移除 panel 的 `padding: 16px`，消除边距留白
- 更新 CSS 变量，使用 Chrome DevTools 原生配色方案
- 更新字体栈，匹配 Chrome DevTools 原生字体
- 优化深色/浅色主题切换，精确匹配 Chrome DevTools 的颜色值
- 调整组件样式（按钮、输入框、列表等），符合 Chrome DevTools 风格

## Capabilities

### New Capabilities
- `devtools-native-styling`: 原生 Chrome DevTools 视觉风格，包括配色、字体、间距

### Modified Capabilities
- `dark-mode-support`: 更新深色主题颜色值，匹配 Chrome DevTools 原生深色主题

## Impact

- 修改 [App.module.css](packages/extension/src/entrypoints/devtools-panel/App.module.css)
- 可能需要更新各组件的 CSS Module 文件
- 不影响功能逻辑，仅涉及视觉样式