# Enhance Media Display with Virtual Masonry

## Summary

综合解决三个问题：历史图片展示、分类进度可视化、虚拟列表性能优化。

## Motivation

当前 DevTools Panel 存在以下问题：

1. **历史图片不显示**: 只显示 NetworkListener 实时捕获的图片，不显示 Proxy 中存储的 815 个历史文件
2. **分类进度不直观**: 只在每个图片上有状态徽章，缺少全局进度概览
3. **性能问题**: 随着图片数量增加，MediaGrid 渲染所有 DOM 节点，导致性能下降

## Goals

1. **历史图片展示** - DevTools Panel 打开时自动加载历史图片，分页加载（每次 50 个）
2. **分类进度可视化** - 新增 ClassifyProgressSection 显示全局分类队列状态和进度条
3. **虚拟列表优化** - 使用 @virtuoso.dev/masonry 实现虚拟化 Masonry 网格，只渲染可见项目
4. **数据合并** - WebSocket 实时新文件插入顶部，分类状态实时更新

## Non-goals

- 不修改 AI Classify 的分类逻辑
- 不实现图片编辑功能
- 不实现批量操作功能

## Scope

- **Proxy**: 扩展 /images API 支持分页和额外字段
- **Extension**: 新增 hooks 和 components 实现虚拟化 Masonry 网格
- **Affected packages**: packages/proxy, packages/extension

## Dependencies

- 新依赖: `@virtuoso.dev/masonry` (Extension)

## Risks

- Masonry 虚拟化复杂度高，需要仔细处理动态高度测量
- WebSocket 数据与历史数据合并可能存在竞态条件
- 缩略图加载可能影响滚动性能

## Success Criteria

- DevTools Panel 打开时显示前 50 个历史图片
- 滚动到底部自动加载更多图片
- 815 个图片渲染时保持流畅（< 50ms 响应时间）
- 新捕获的图片立即显示在顶部
- 分类进度条实时更新