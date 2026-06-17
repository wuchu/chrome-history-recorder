## Context

当前，`getVisibleTabs()` 函数位于 `packages/extension/src/shared/tag-utils.ts`，它决定了哪些标签显示在 `ScrollableTabBar` 组件中。目前的行为是：
- 系统标签只有在 count > 0 时才显示
- 用户标签只有在 count > 0 时才显示
- "全部" 标签始终显示

系统标签定义在 `SYSTEM_TAGS` 数组中：
- "全部" (ALL_TAG)
- "📷 图片" (system:image)
- "🎬 视频" (system:video)
- "⭐ 已收藏" (system:starred)
- "未分类" (system:uncategorized)

## Goals / Non-Goals

**Goals:**
- 让所有系统标签始终显示在标签栏中，即使 count 为 0
- 保持用户标签的现有行为（只在有文件时显示）
- 保持标签计数的显示（包括显示 0）
- 最小化代码变更，保持实现简单

**Non-Goals:**
- 不改变用户标签的行为
- 不改变标签点击后的过滤逻辑
- 不添加新的配置选项
- 不改变标签的排序顺序

## Decisions

### Decision 1: 直接修改 `getVisibleTabs()` 移除系统标签的 count > 0 检查

**选项考虑：**
- A. 直接修改 `getVisibleTabs()`，移除系统标签的 count > 0 检查 ✓
- B. 添加新的配置选项来控制这个行为
- C. 创建新的函数来替代 `getVisibleTabs()`

**选择 A 的理由：**
- 这是最简单直接的方案
- 符合 YAGNI 原则，目前不需要配置选项
- 最小化代码变更范围
- 易于理解和维护

**实现细节：**
- 保留 ALL_TAG 始终添加的逻辑
- 对 SYSTEM_TAGS 中的每个标签，直接添加而不检查 count > 0
- 用户标签部分保持不变，仍然检查 count > 0

### Decision 2: 继续显示 0 作为计数

**选项考虑：**
- A. 始终显示计数（包括 0）✓
- B. count 为 0 时不显示计数
- C. 对 0 使用特殊样式

**选择 A 的理由：**
- 保持 UI 一致性
- 清晰传达该分类目前是空的
- 与现有 `ScrollableTabBar` 组件的实现兼容，无需修改
- 实现最简单

## Risks / Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| 标签栏可能变得过长（如果有很多系统标签） | 低 | 中 | 目前只有 5 个系统标签，`ScrollableTabBar` 已经支持滚动，可接受 |
| 用户可能困惑为什么有些标签是空的 | 低 | 低 | 计数 0 会清晰传达状态，且这是预期行为 |
| 性能影响 | 极低 | 极低 | 纯前端计算，没有 API 调用或额外处理 |

## Migration Plan

1. 修改 `getVisibleTabs()` 函数
2. 测试验证行为符合预期
3. 无需数据库迁移或数据变更
4. 无需回滚计划（可以通过 git revert 轻松回退）

## Open Questions

无 - 设计已确定。
