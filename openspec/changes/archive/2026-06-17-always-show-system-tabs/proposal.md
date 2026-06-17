## Why

当前系统标签（全部、图片、视频、已收藏、未分类）只在有对应文件时才显示在标签栏中，这导致用户刚使用扩展时标签栏显得很空，且无法预知有哪些分类可用。我们希望系统标签始终显示，提供更一致和可预期的用户体验。

## What Changes

- 修改 `getVisibleTabs()` 函数，使所有系统标签始终显示在标签栏中，即使它们的文件计数为 0
- 用户标签继续保持现有行为：仅在有对应文件时显示
- 标签上的文件计数正常显示（包括 0）

## Capabilities

### New Capabilities

- `system-tabs-always-visible`: 系统标签始终在标签栏中显示的功能

### Modified Capabilities

- 无

## Impact

- 受影响的代码：`packages/extension/src/shared/tag-utils.ts` 中的 `getVisibleTabs()` 函数
- UI 影响：SidePanel 中的 `ScrollableTabBar` 组件将始终显示所有系统标签
- 无破坏性变更：现有功能和 API 保持不变
