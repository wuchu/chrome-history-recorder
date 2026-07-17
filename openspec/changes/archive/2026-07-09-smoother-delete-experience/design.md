## Context

当前删除流程：
- 用户点击删除 → 发送 `deleteFile` message
- Background 处理并广播 `file:deleted` 事件
- 前端调用 `historicalImages.refresh()` 重新拉取所有数据
- 导致整个 masonry grid 重绘，滚动条跳变

现有基础设施：
- `useCombinedMedia` 已有 `extractDeletedHashes` 函数，会从 `backgroundEvents` 中提取删除事件并过滤
- 不需要重新拉取也能正确更新列表

## Goals / Non-Goals

**Goals:**
- 删除后保持滚动位置稳定
- 避免不必要的网络请求和全量重绘
- 利用现有事件驱动的基础设施

**Non-Goals:**
- 不实现删除动画
- 不改变删除确认逻辑
- 不修改后端删除逻辑

## Decisions

### Decision 1: 移除 `historicalImages.refresh()` 调用
**Rationale**: `useCombinedMedia` 已经能通过监听 `file:deleted` 事件来正确过滤删除的项目，不需要重新拉取。

**Alternatives considered:**
- 保存滚动位置后刷新再恢复 → 仍然有闪烁，不必要的网络请求
- 实现本地缓存层 → 过度设计

### Decision 2: 依赖 `file:deleted` 事件来同步状态
**Rationale**: 事件已存在，`useCombinedMedia` 已经有处理逻辑。

**Alternatives considered**:
- 乐观更新（先本地移除，后台同步）→ 增加复杂度，可能状态不一致
- 保持双路更新（事件 + 刷新）→ 没有意义

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 事件丢失导致状态不一致 | 在标签切换时仍然会 refresh，可以作为同步点 |
| 删除后分页出现空缺 | VirtualMasonryGrid 的 loadMore 机制会在需要时自动加载更多 |
| 删除后 tag counts 不同步 | 现有的 `file:deleted` 监听已经在更新 tag counts |

## Migration Plan

1. 修改 `sidepanel/App.tsx` 中的 `handleDeleteItem` 函数
2. 移除 `historicalImages.refresh()` 调用
3. 保留关闭详情的逻辑
4. 测试滚动位置稳定性

Rollback: 重新添加 `historicalImages.refresh()` 即可

## Open Questions

无
