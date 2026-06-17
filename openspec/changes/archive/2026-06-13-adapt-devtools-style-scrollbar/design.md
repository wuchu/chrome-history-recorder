## Context

当前项目的 DevTools 面板使用浏览器默认滚动条样式，与 Chrome DevTools 原生风格不协调。项目已经实现了完整的明暗双主题支持，但滚动条样式未进行主题适配。特别是 ScrollableTabBar 组件完全隐藏了滚动条（使用 `scrollbar-width: none` 和 `::-webkit-scrollbar { display: none }`），导致用户无法直观地知道还有更多标签可查看。

**当前状态：**
- App.module.css 定义了完整的 CSS 变量用于明暗主题
- MediaGrid、MediaDetail 等组件有滚动区域但使用默认滚动条
- ScrollableTabBar 完全隐藏滚动条

**约束条件：**
- 需要兼容 Chrome/Edge 浏览器（基于 WebKit 的浏览器）
- 需要同时支持 Firefox（使用 `scrollbar-width` 和 `scrollbar-color`）
- 保持现有功能不变，仅调整样式

## Goals / Non-Goals

**Goals:**
- 为所有可滚动区域应用 Chrome DevTools 风格的滚动条
- 确保滚动条样式在明暗主题下都有正确的配色
- 修改 ScrollableTabBar，从隐藏滚动条改为显示精致的滚动条
- 保持滚动条的功能完整性（滚动、拖拽等）

**Non-Goals:**
- 不改变滚动行为（如滚动速度、惯性滚动等）
- 不添加新的可滚动区域
- 不修改非 DevTools 面板的滚动条（如 options 页面）

## Decisions

### Decision 1: 使用 CSS 自定义滚动条属性

**选择：** 使用 `::-webkit-scrollbar` 系列属性（WebKit）和 `scrollbar-width`/`scrollbar-color`（Firefox）

**替代方案：**
- 使用 JavaScript 实现自定义滚动条 - 过于复杂，可能引入性能问题
- 使用第三方库（如 simplebar） - 增加依赖，不必要

**理由：** CSS 方案简单、轻量、性能好，且足够满足 DevTools 风格需求。

### Decision 2: 滚动条尺寸设计

**选择：** 滚动条宽度 10px，滑块最小高度 20px，圆角 2px

**替代方案：**
- 更细的 8px - 可能难以点击
- 更宽的 12px - 占用空间过多

**理由：** 10px 是 Chrome DevTools 常用的滚动条宽度，兼顾可用性和美观。

### Decision 3: 配色方案

**选择：**
- 浅色主题：Track #f1f1f1，Thumb #c1c1c1，Hover #a1a1a1
- 深色主题：Track #2d2d30，Thumb #5a5a5a，Hover #787878

**替代方案：**
- 使用项目已有的 `--bg-tertiary` 和 `--border-color` 变量

**理由：** 专门设计的滚动条配色更贴近 Chrome DevTools 原生风格，但我们会将这些值添加为新的 CSS 变量以便维护。

### Decision 4: ScrollableTabBar 的调整

**选择：** 移除 `scrollbar-width: none` 和 `::-webkit-scrollbar { display: none }`，改为应用标准滚动条样式

**替代方案：**
- 保持隐藏 - 用户体验不佳
- 添加滚动指示箭头 - 增加复杂度

**理由：** 显示滚动条是最直观的方式，让用户知道还有更多内容可查看。

## Risks / Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| 某些浏览器不支持 CSS 自定义滚动条 | 低 | 低 | 优雅降级，使用默认滚动条 |
| 滚动条在某些操作系统下显示异常 | 中 | 低 | 测试主流操作系统（macOS, Windows, Linux） |
| 滚动条与某些组件布局冲突 | 低 | 中 | 确保滚动条不影响现有布局计算 |

## Open Questions

无 - 设计方案已明确。
