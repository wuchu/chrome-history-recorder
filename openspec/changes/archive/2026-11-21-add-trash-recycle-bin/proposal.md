## Why

当前的"软删除"只把 `files.is_deleted` 置为 1：条目从媒体库消失，但没有恢复入口、用户看不到这些文件，blob 仍永久占用磁盘；而直接改成硬删除又会带来误删不可恢复的风险。回收站把删除变成可撤销操作：移入回收站时保留磁盘内容与归档副本，只有用户明确执行永久删除（或清空回收站）时才真正释放存储。

## What Changes

- **删除语义改为移入回收站**：复用现有 `is_deleted` / `deleted_at` 列（保留列名，对外的 API、事件、UI、spec 使用 trash 词汇），保留 blob、缩略图与归档副本，零破坏性数据迁移；历史软删除数据自然成为回收站初始内容。
- **新增回收站 API**：`trashFile`、`restoreFile`、`purgeFile`、`emptyTrash`、`restoreAll`；`listFiles` 增加 `status: 'active' | 'trashed' | 'all'` 过滤；统计增加回收站条目数与占用。**BREAKING**：WebSocket 方法 `deleteFile {hash, hard?}` 由 `trashFile {hash}` 取代，永久删除改用 `purgeFile`。
- **永久删除清理所有副本**：删除 blob、该 hash 的缩略图（含 `<hash>-frame.jpg`）、当前归档目标中的 `<hash>.<ext>`、关联任务与数据库行，并重算标签使用计数。归档副本删除通过 `setPurgeHook` 由 app 层注入（VFS 不知道归档路径）。
- **任务挂起**：`claimTasks` 过滤目标文件在回收站中的任务，移入回收站期间任务自动暂停；恢复后自动继续；永久删除时随行删除任务。
- **重复采集自动恢复**：`saveFile` 发现同一内容已存在于回收站时，自动恢复该行并广播 `file:restored`，避免"重新截图后媒体库没有反应"。
- **新增事件**：`file:trashed`、`file:restored`、`file:purged`、`trash:emptied`、`trash:restored-all`，替换语义模糊的 `file:deleted`。
- **Options 新增回收站页面**：左侧一级导航新增「回收站」（`#trash`），复用现有媒体网格与详情组件，支持逐项恢复、逐项永久删除、恢复全部、清空回收站；仅手动清理，不提供自动过期。
- **性能**：新增回收站部分索引 `idx_files_trash ON files(deleted_at DESC) WHERE is_deleted = 1`；移入/恢复后调用 `recomputeTagUsage()`。
- **归档语义调整**：移入回收站不删除归档副本；永久删除会删除归档副本，因此 `media-archive-sync` 的"单向归档"要求需要改写。

## Capabilities

### New Capabilities

- `trash-management`: 回收站的完整生命周期——移入、列出、恢复、恢复全部、永久删除、清空，以及回收站期间 blob/缩略图/归档副本的保留策略和自动恢复规则。

### Modified Capabilities

- `vfs-service`: `deleteFile` 改为移入回收站；新增 `restoreFile` / `purgeFile` / `emptyTrash` / `restoreAll` 与 `listFiles.status` 过滤；永久删除清理 blob、缩略图与数据库行。
- `vfs-websocket-server`: 新增 `file:trashed` / `file:restored` / `file:purged` / `trash:emptied` 广播，删除旧 `file:deleted` 事件。
- `extension-file-manager`: 转发新事件与回收站相关消息类型，更新删除调用为 `trashFile`。
- `options-console`: 新增一级导航「回收站」与 `#trash` 路由，深链与刷新恢复行为覆盖该页面。
- `options-media-library`: 删除操作改为移入回收站并更新确认文案；媒体库不再显示回收站条目。
- `side-panel-media-browser`: 监听 `file:trashed` 代替 `file:deleted`，从网格移除条目。
- `task-queue`: `claimTasks` 排除目标文件在回收站中的任务；永久删除时删除关联任务。
- `app-task-scheduler`: 回收站条目不再被 AI 任务处理，恢复后任务继续；对已删除条目不再产生失败重试。
- `media-archive-sync`: 移入回收站保留归档副本；永久删除移除归档副本；改写"单向归档"要求与"[In the trash]"场景；恢复后重新入队。
- `app-event-bus`: 文件事件从 `file:deleted` 改为 `file:trashed` / `file:restored` / `file:purged` / `trash:emptied` / `trash:restored-all`，并覆盖重复采集自动恢复。

## Impact

- **vfs**：`api.ts`（删除/恢复/永久删除/清空/列表/统计、`setPurgeHook`）、`sqlite.ts`（列表状态过滤、claim 过滤、回收站索引、标签重算、任务清理）、`blob.ts`、`thumbnail.ts`（按 hash 删除）、`dispatcher.ts`、`websocket-server.ts`。
- **app**：`handlers.ts`（回收站 RPC）、`media-archive.ts`（归档副本删除、在途复制完成后的存在性校验）、`media-eligibility.ts` / `index.ts`（回收站条目守卫可简化）、`scheduler.ts`（事件与状态）。
- **extension**：`background/vfs-ws-client.ts`、`background/file-manager.ts`、`entrypoints/background/index.ts`、`entrypoints/options/App.tsx`、`entrypoints/options/tabs.ts`、新增 `TrashPage`、`MediaLibrary.tsx`、`MediaDetail.tsx`、`media-browser/hooks/useCombinedMedia.ts`、`useHistoricalImages.ts`。
- **OpenSpec**：新增 `trash-management` spec，更新上述 9 个既有 capability 的 delta specs。
- **测试**：`vfs/test/api.test.ts`、`sqlite.test.ts`、`integration.test.ts`、`tasks-tags.test.ts`、`app/test/media-archive.test.ts`，以及扩展侧事件/页面测试（如有）。
- **兼容性**：WebSocket 方法名与事件名变更属于内部协议破坏性变更；app 与扩展同版本发布，无外部消费者。
