## Why

删除媒体时调用 `historicalImages.refresh()` 导致整个页面重新拉取和布局，滚动条跳变，用户体验不好。利用现有的 `file:deleted` 事件和 `useCombinedMedia` 的过滤逻辑，可以实现更平滑的局部更新。

## What Changes

- 移除删除后的 `historicalImages.refresh()` 调用
- 依靠 `file:deleted` 事件和 `useCombinedMedia` 的本地过滤来更新列表
- 保持滚动位置稳定，避免页面跳变

## Capabilities

### New Capabilities

### Modified Capabilities
- `side-panel-media-browser`: 删除后不触发全量刷新，使用事件驱动的局部更新

## Impact

- 受影响文件：`sidepanel/App.tsx`
- 无破坏性变更，纯粹是用户体验优化
- 利用已有基础设施（`file:deleted` 事件、`useCombinedMedia` 的删除过滤）
