## 1. 算法调整

- [x] 1.1 修改 `packages/extension/src/entrypoints/devtools-panel/hooks/useColumnCount.ts` 中的 `calculateColumns`：移除 `Math.min(5, …)` 上限，将下限从 2 改为 1。
- [x] 1.2 在 `calculateColumns` 顶部添加防御：当 `width <= 0` 时直接返回 1，避免初次渲染（容器尚未挂载）时 `floor` 得到 0。
- [x] 1.3 同步更新文件头注释中提到的 "Minimum 2 columns, maximum 5 columns" 描述。

## 2. 规格同步

- [x] 2.1 在 `openspec/specs/virtual-masonry-grid/spec.md` 的 REQ-4 区块替换分档表述（500/800/1100 px）为"按容器宽度连续计算，下限 1 列、上不封顶"，与 delta spec 一致。
- [x] 2.2 保留 REQ-4.1（`ResizeObserver`），其余 REQ-4.x 子项整合为单条公式描述与边界条件说明。

## 3. 验证

- [x] 3.1 在 DevTools 面板把窗口拉到极窄（< 250px），确认 Masonry 退化为单列、无重叠。
- [x] 3.2 在 1080p / 2K / 4K 模拟下确认列数随宽度连续增长，不再卡 5 列上限。
- [x] 3.3 运行 `pnpm lint` 与 `pnpm test` 确认无回归。
- [x] 3.4 运行 `pnpm --filter extension build` 确认产物正常生成。
