## Context

`packages/extension/src/entrypoints/devtools-panel/hooks/useColumnCount.ts` 已通过 `ResizeObserver` 监听容器宽度并实时计算列数，但 `calculateColumns` 把结果硬限制在 `[2, 5]`：

```ts
return Math.max(2, Math.min(5, columns));
```

唯一消费方是 `VirtualMasonryGrid`（基于 `@virtuoso.dev/masonry` 的虚拟化 Masonry），列数会传入 Virtuoso 的 `columnCount` 属性。Virtuoso Masonry 本身不限制列数，瓶颈完全在我们这一层 clamp。

DevTools 面板可被用户拖到任意宽度，且 options 页面已改为新标签页全屏后，该 hook 也可能被复用到更宽的容器。

## Goals / Non-Goals

**Goals:**
- 根据容器宽度连续计算列数：`columns = Math.floor((width + gap) / (columnWidth + gap))`。
- 极窄容器（宽度小于 `columnWidth + gap`）退化为 1 列，避免渲染异常。
- 上不封顶——容器越宽，列数越多，由列宽 / gap 决定理论最大值。
- 保持现有 API：`columnWidth`、`gap` 默认值不变（200 / 10），调用方无需修改。

**Non-Goals:**
- 不引入"列宽随容器伸缩"的 fluid 列宽（仍维持固定列宽）。
- 不替换底层 Masonry 库或重写虚拟化策略。
- 不改 `MasonryItem` 渲染逻辑或 CSS Grid 结构。
- 不为列数引入用户级配置项（保持隐式自适应）。

## Decisions

**1. 公式继续使用 floor 算法，仅放开上下界**

```ts
const columns = Math.floor((width + gap) / (columnWidth + gap));
return Math.max(1, columns);
```

替代方案：使用 CSS Grid `repeat(auto-fill, minmax(columnWidth, 1fr))`。被否决，原因是 `VirtualMasonryGrid` 是 JS 计算坐标 + 绝对定位的虚拟化方案，改 CSS Grid 等于重写整套虚拟列表，超出本次 scope。

**2. 下限选择 1 而不是 2**

替代方案 a：保持下限 2。被否决，因为容器宽度 < ~410px 时强制 2 列会让缩略图小于约 200px / 2 = 100px，明显不可识别。
替代方案 b：下限 0。被否决，会让 `Math.floor(...)` 返回 0 时整个网格不渲染。

**3. 上不封顶**

替代方案：保留 `Math.min(N, columns)` 但放宽到 8 / 10。被否决，硬编码上限只能延后问题，且 4K / 超宽屏 / 多屏拼接场景下任何固定上限都会出现新的右侧空白。容器宽度天然就是上限。

**4. 算法中 `width` 使用 `clientWidth`，与现有保持一致**

不切到 `getBoundingClientRect().width`。`clientWidth` 已可正确剔除滚动条宽度，且现有 `ResizeObserver` 默认 `contentBoxSize` 与之一致，避免引入半像素计算误差。

## Risks / Trade-offs

- **风险：宽屏列数极多导致一行项目过窄难以辨认** → 列宽固定为 `columnWidth`（默认 200px），不会被压缩，仅是"列更多"，每张缩略图大小不变；用户体感是更密更密，不是更小。
- **风险：极窄面板下 1 列时 Masonry 退化为简单纵向列表，可能出现项目高度过高** → 这是预期行为，纵向列表本就是最自然的窄屏排布；项目高度由原图比例决定，与列数无关。
- **风险：Virtuoso 在 columnCount 频繁切换时可能触发重排** → 已有 ResizeObserver 节流由浏览器内部去抖动，且 `useColumnCount` 仅在结果变化时调用 `setColumnCount`（React 自动 bail out 相同值），不增加额外抖动来源。
- **trade-off：放弃为不同 breakpoint 设计精细列数曲线** → 接受。当前没有产品诉求需要"800–1100px 必须是 4 列"这类离散点，连续公式既符合用户描述又更可预测。
