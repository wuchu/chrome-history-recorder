## 1. VFS 存储层

- [x] 1.1 在 `FILES_TABLE_SCHEMA` 中新增 `idx_files_trash ON files(deleted_at) WHERE is_deleted = 1` 部分索引，并确认 `initializeSchema` 对已有数据库自动生效
- [x] 1.2 在 `is_deleted` / `deleted_at` 列与 `FileMetadata` 类型上补充"回收站状态"注释，明确两者只在 trash/restore 时成对写入
- [x] 1.3 为 `ThumbnailStorage` 增加 `deleteByHash(hash)`，按 `<hash>-*.jpg` 前缀清理所有尺寸与 `-frame` 缓存，目录或文件缺失时静默成功
- [x] 1.4 扩展 `ListQuery`：以 `status?: 'active' | 'trashed' | 'all'` 取代 `includeDeleted`，默认 `active`，`orderBy` 支持 `deleted_at`
- [x] 1.5 更新 `listFiles` 的 WHERE/ORDER 逻辑：active/trashed/all 三种状态、`trashed` 默认按 `deleted_at` 倒序、分页与 `hasMore` 保持一致
- [x] 1.6 在 `claimTasks` 的 SQL 中排除目标文件 `is_deleted = 1` 的任务，保持任务状态不变
- [x] 1.7 更新队列状态查询，排除目标在回收站中的任务计数（pending/failed 等）
- [x] 1.8 在 `getStats` 中新增 `trashFiles` / `trashSize`，活跃统计继续只计 `is_deleted = 0`
- [x] 1.9 清理 `includeDeleted` 相关的旧类型与查询分支
- [x] 1.10 为 trash/restore/purge/emptyTrash/restoreAll 的 DB 操作补充 `recomputeTagUsage()` 与事务边界

## 2. VFS API 与生命周期

- [x] 2.1 将 `deleteFile` 改为 `trashFile({ hash })`：写 `is_deleted=1` / `deleted_at`，保留 blob、缩略图与归档副本
- [x] 2.2 新增 `restoreFile({ hash })`：复用 `db.restoreFile`，成功后调用 restore hook
- [x] 2.3 新增 `restoreAll()`：批量恢复并返回 `{ success, count }`，逐 hash 调用 restore hook
- [x] 2.4 新增 `purgeFile({ hash })`：缩略图 → blob → purge hook → 事务删 tasks/files → 重算标签；缺失 hash 幂等成功
- [x] 2.5 新增 `emptyTrash()`：收集全部回收站 hash，逐条清理磁盘与归档副本，再事务删行并返回 `{ success, count }`
- [x] 2.6 为 `VFSAPI` 增加可选的 `setPurgeHook((hash, metadata) => …)` 与 `setRestoreHook((hash) => …)`，钩子异常只记录警告
- [x] 2.7 在 `saveFile` 与 `saveFileFromStream` 中实现重复内容自动恢复：返回 `{ duplicate: true, restored: true }`，并让 ingest hook 能区分恢复
- [x] 2.8 移除 `deleteFile` / `hard` 参数及相关分支，确保没有遗留调用

## 3. 传输层

- [x] 3.1 在 `dispatcher.ts` 中注册 `trashFile`、`restoreFile`、`restoreAll`、`purgeFile`、`emptyTrash`，移除 `deleteFile`
- [x] 3.2 在 WebSocket 服务中广播 `file:trashed`、`file:restored`、`file:purged`、`trash:emptied`、`trash:restored-all`，移除 `file:deleted` 广播
- [x] 3.3 确认 `listFiles` 的 `status` 参数与 `getStats` 的回收站字段可通过 WS 原样传递
- [x] 3.4 检查 `GET /files/:hash` 与缩略图路由对回收站条目的行为保持不变（可读取，用于回收站预览）

## 4. App 集成

- [x] 4.1 在 `app/src/index.ts` 注册 purge hook：删除当前归档目标中的 `<hash>.<ext>`，目标未启用/不存在/权限失败时记录警告并继续
- [x] 4.2 在 `app/src/index.ts` 注册 restore hook：归档启用时调用 `mediaArchive.enqueue(hash)`
- [x] 4.3 为 `MediaArchiveWorker` 增加 `deleteArchived(hash, ext)`，复用目标校验逻辑并忽略 `ENOENT`
- [x] 4.4 在 `copyOne` 落盘后重新读取 metadata；行已被永久删除时移除刚写入的目标文件，被移入回收站时保留
- [x] 4.5 更新 ingest hook 处理 `{ restored: true }`：广播 `file:restored` 而不是 `file:captured`，AI/归档入队保持幂等
- [x] 4.6 在 app 事件路径中移除 `file:deleted`，补齐五个回收站事件
- [x] 4.7 简化 `media-eligibility.ts` / `index.ts` / `media-archive.ts` 中对 `is_deleted` 的守卫：保留"回收站目标不可处理"的必要判断，删除已失效分支

## 5. 扩展 Background

- [x] 5.1 `vfs-ws-client.ts`：以 `trashFile` / `restoreFile` / `restoreAll` / `purgeFile` / `emptyTrash` 替换 `deleteFile(hash, hard?)`，`VFSListQuery` 增加 `status`
- [x] 5.2 `file-manager.ts`：更新删除/恢复/永久删除的转发方法与事件类型联合
- [x] 5.3 `entrypoints/background/index.ts`：处理新的消息类型并透传 Background 事件
- [x] 5.4 移除 `is_deleted` 的旧使用假设，保留元数据类型中的字段供回收站判断使用

## 6. Options 回收站页面

- [x] 6.1 `tabs.ts`：`CONSOLE_TABS` 增加 `'trash'`
- [x] 6.2 `App.tsx`：`NAV_ITEMS` 与 section 列表增加「回收站」项（`DeleteOutlined`，`#trash`）
- [x] 6.3 扩展 `useHistoricalImages` 支持 `status: 'trashed'` 并透传到 `listFiles`
- [x] 6.4 新建 `TrashPage`：标题、条目数/占用、`恢复全部`、`清空回收站`、空状态与加载/错误态
- [x] 6.5 `TrashPage` 复用 `VirtualMasonryGrid` 与分页，按 `deleted_at` 倒序展示回收站条目
- [x] 6.6 `TrashPage` 提供逐项「恢复」与「永久删除」，并处理 `file:restored` / `file:purged` / `trash:emptied` / `trash:restored-all` 后的刷新
- [x] 6.7 `MediaDetail` 增加回收站模式：显示删除时间、恢复、永久删除；隐藏收藏/标签编辑/重跑任务
- [x] 6.8 `MediaLibrary.tsx`：删除改为 `trashFile`，确认文案改为「移入回收站，可稍后恢复」
- [x] 6.9 `useCombinedMedia` / 事件类型：用 `file:trashed` 移除条目，`file:restored` 触发恢复显示
- [x] 6.10 永久删除与清空的确认框明确提示不可恢复且归档副本会删除；`恢复全部` 同样需要确认

## 7. 测试

- [x] 7.1 更新 `packages/vfs/test/sqlite.test.ts`：trash/restore/list status/claim 过滤/队列计数/统计/索引
- [x] 7.2 更新 `packages/vfs/test/api.test.ts`：trashFile、restoreFile、restoreAll、purgeFile、emptyTrash、自动恢复、缩略图与 blob 删除
- [x] 7.3 更新 `packages/vfs/test/integration.test.ts`：WS 方法名、事件广播与 list status
- [x] 7.4 更新 `packages/vfs/test/tasks-tags.test.ts`：purge 删除任务、标签计数重算、回收站任务不可领取
- [x] 7.5 更新 `packages/app/test/media-archive.test.ts`：trash 保留副本、purge 删除副本、恢复重新入队、在途复制竞争
- [x] 7.6 补充/更新扩展侧消息与回收站页面逻辑测试（若现有测试框架覆盖）

## 8. 验证与收尾

- [x] 8.1 运行 `pnpm test`，确认全部通过
- [x] 8.2 运行 `pnpm lint` 与 `pnpm format:check`
- [ ] 8.3 手动验证：删除 → 回收站可见 → 恢复 → 再次采集同一内容自动恢复 → 永久删除 → 归档副本与 blob 消失 → 清空回收站
- [x] 8.4 手动验证历史软删除数据在升级后出现在回收站并可恢复/永久删除
- [x] 8.5 更新 `README.md` / `ARCHITECTURE.md` 中与删除语义相关的描述（如存在）
