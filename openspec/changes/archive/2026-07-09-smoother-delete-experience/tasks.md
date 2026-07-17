## 1. 核心优化

- [x] 1.1 在 `sidepanel/App.tsx` 中移除 `handleDeleteItem` 里的 `historicalImages.refresh()` 调用
- [x] 1.2 保留关闭详情的逻辑（如果删除的是当前查看的项目）

## 2. 验证测试

- [x] 2.1 测试从缩略图删除后滚动位置保持稳定
- [x] 2.2 测试从详情页删除后滚动位置保持稳定
- [x] 2.3 测试删除后 masonry layout 正确重排
- [x] 2.4 验证 tag counts 在删除后正确更新
