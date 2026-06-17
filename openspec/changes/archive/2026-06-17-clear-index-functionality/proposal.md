## Why

当前系统提供了"同步原始媒体到索引"功能，可以将 blobs/ 目录中的物理文件同步到 SQLite 索引中，但没有提供清空索引的功能。当索引出现问题、损坏，或者用户想要完全重建索引时，没有便捷的方法来清空现有索引。我们希望添加一个"清空索引"功能，让用户可以清空 SQLite 索引记录（不删除物理文件），然后重新同步建立新索引。

## What Changes

- 在 VFS Service 的 SQLite 层添加 `clearIndex()` 方法，清空 `files` 表和 `classify_queue` 表
- 在 VFS API 添加 `clearIndex` API 方法
- 在 WebSocket dispatcher 添加 `clearIndex` 路由
- 在 Extension 的 VFS WebSocket Client 添加 `clearIndex()` 方法
- 在 Extension runtime 添加 `clearIndex()` 调用
- 在 Options 页面的"媒体索引维护"卡片添加"清空索引"按钮
- 添加确认对话框，防止误操作
- 清空后不自动同步，让用户手动点击"同步"

## Capabilities

### New Capabilities

- `clear-index-functionality`: 清空 VFS SQLite 索引的功能

### Modified Capabilities

- 无

## Impact

- 受影响的代码：
  - `packages/vfs-service/src/sqlite.ts`
  - `packages/vfs-service/src/api.ts`
  - `packages/vfs-service/src/dispatcher.ts`
  - `packages/vfs-service/src/websocket-server.ts` (可选)
  - `packages/extension/src/background/vfs-ws-client.ts`
  - `packages/extension/src/shared/extension-runtime.ts`
  - `packages/extension/src/entrypoints/background/index.ts`
  - `packages/extension/src/entrypoints/options/hooks/useOptionsData.ts`
  - `packages/extension/src/entrypoints/options/App.tsx`
- UI 影响：Options 页面的"媒体索引维护"卡片将新增"清空索引"按钮
- 无破坏性变更：现有功能和 API 保持不变
