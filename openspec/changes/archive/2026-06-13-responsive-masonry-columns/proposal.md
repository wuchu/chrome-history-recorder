## Why

DevTools 媒体面板使用 `useColumnCount` 按容器宽度动态计算 Masonry 列数，但当前实现把列数硬限制在 `[2, 5]`。在宽屏 / DevTools 浮动窗口被拉到很宽时，右侧出现明显空白；在极窄面板下，强制 2 列又会让缩略图挤成不可识别的尺寸。用户期望栏数随容器宽度真正连续自适应——窄到极限退到 1 列，宽到极限不再封顶。

## What Changes

- 调整 `useColumnCount` 算法：取消上限封顶（`Math.min(5, …)` 移除），下限放宽到 1 列。
- 列宽目标值 `columnWidth` 与列间距 `gap` 仍保持现有默认值，便于消费方覆盖。
- 容器宽度极小（小于一个列宽 + gap）时安全退化为 1 列，避免出现 0 列导致渲染崩溃。
- 同步更新 `virtual-masonry-grid` spec 中 REQ-4 的响应式列数表述，反映新的连续算法。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `virtual-masonry-grid`: REQ-4 响应式列数从「分档 2–5 列」改为「按容器宽度连续计算，下限 1 列、上不封顶」。

## Impact

- 代码：`packages/extension/src/entrypoints/devtools-panel/hooks/useColumnCount.ts`（核心算法）。
- 行为：`VirtualMasonryGrid` / `MasonryItem` 在宽屏下显示更多列；在极窄面板下退化到 1 列单栏排布。
- 兼容：`columnWidth` / `gap` 默认值保持不变，所有现有调用点零改动。
- 风险：宽屏列数极多时单元格仍按目标列宽渲染，内存与节点数受虚拟化保护，无需额外优化。
