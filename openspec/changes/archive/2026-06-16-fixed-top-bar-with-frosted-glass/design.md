## Context

当前 Side Panel 布局中，顶部区域（StatusBar、工具栏、CaptureStream、ClassifyProgressSection、ScrollableTabBar）随主内容一起滚动。用户在浏览大量媒体文件时，无法快速访问标签切换或捕获控制。

现有代码中，`App.module.css` 已包含 `.topFixedContainer` 和 `.contentContainer` 样式，但未在 JSX 中使用。

## Goals / Non-Goals

**Goals:**
- 顶部 tab bar 及以上组件固定在视口顶部，不随内容滚动
- 固定区域使用毛玻璃背景效果
- 全局禁止横向滚动条
- 确保内容区域不被固定区域遮挡

**Non-Goals:**
- 不改变各组件的功能逻辑
- 不调整组件内部布局
- 不添加新功能

## Decisions

### Decision 1: 使用固定高度还是动态 padding
**选择**: 使用足够大的固定 `padding-top`（250px）

**原因**: 
- CaptureStream 是条件显示的，固定区域高度会动态变化
- 使用固定 padding 实现简单，不需要额外的 JavaScript 计算高度
- 250px 足够容纳所有可能显示的顶部组件
- 过多的空白不会严重影响用户体验

**备选方案**: 使用 ResizeObserver 监听固定容器高度，动态调整 padding-top

### Decision 2: 毛玻璃效果应用范围
**选择**: 在顶层容器上应用毛玻璃效果

**原因**:
- 所有顶部组件背景可以保持原样
- 毛玻璃效果通过顶层容器统一实现，更一致

### Decision 3: 禁止横向滚动的实现
**选择**: 在 `html, body` 和 `.panel` 上设置 `overflow-x: hidden`

**原因**:
- 确保从根元素开始就不会出现横向滚动
- 同时保持纵向滚动正常工作

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| 固定 `padding-top` 在小屏幕上可能显得过大 | 中等 | 使用合理的 250px 值，未来可根据需要优化为动态计算 |
| 毛玻璃效果在旧版浏览器不支持 | 低 | 提供半透明背景作为降级方案，已有 `rgba(..., 0.95)` |
| 固定区域可能遮挡部分内容 | 低 | 通过充分测试验证 padding 值足够 |

## Open Questions

无
