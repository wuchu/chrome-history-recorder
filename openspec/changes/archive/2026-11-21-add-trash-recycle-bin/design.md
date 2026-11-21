## Context

当前删除只有两条路径：默认软删除（`is_deleted=1`，条目从媒体库消失但 blob 永远留在磁盘、没有恢复入口），以及带 `hard=true` 的永久删除（删 blob + 删行）。媒体库和 Side Panel 都调用默认路径，因此用户实际上无法恢复，也无法释放磁盘。回收站把这两种语义拆成用户可见的三步：移入回收站 → 恢复 / 永久删除 → 清空。

存储层已经具备大部分能力：`is_deleted` / `deleted_at` 列、`softDeleteFile`、`restoreFile`、`hardDeleteFile`，以及所有读路径上的 `is_deleted = 0` 过滤。本设计的目标是让这些既有机制承担回收站语义，而不是重建数据模型。

## Goals / Non-Goals

**Goals:**

- 删除变为可恢复；回收站期间 blob、缩略图、归档副本全部保留。
- 永久删除释放所有副本（blob、缩略图、归档副本）与 DB 行。
- 零破坏性迁移：历史软删除数据直接成为回收站初始内容。
- 回收站期间任务挂起，恢复后自动继续，永久删除时随行清理。
- Options 提供独立的回收站页面（`#trash`），支持恢复、恢复全部、永久删除、清空。
- 重复采集回收站中的同一内容时自动恢复。

**Non-Goals:**

- 自动过期 / 按时间自动清空回收站。
- 多级状态机（如"隐藏"与"回收站"分离）或重命名数据库列。
- 清理切换归档目标后遗留的旧归档目录副本。
- 回收站内容的版本历史或审计日志。

## Decisions

### D1. 复用 `is_deleted` / `deleted_at` 作为回收站状态

保留列名与类型，仅在 schema 与 `FileMetadata` 上加注释说明其用户语义为"在回收站"。对外（API、事件、UI、spec）统一使用 trash 词汇。

- 理由：所有既有查询已按 `is_deleted` 过滤，语义与回收站完全一致；零迁移、零数据风险。
- 备选：重命名为 `is_trashed`（需表重建 + 改约 30 处 SQL，只换来可读性）；新增 `status` 枚举（当前只有两态，过度设计）。两者都推迟到真正出现第三态时再做。
- 一致性约定：`is_deleted` 与 `deleted_at` 只在 `trashFile` / `restoreFile` 两处成对写入，禁止单独修改其中一个。

### D2. 显式 API 方法取代 `hard` 参数

WebSocket / VFS API：

| 方法 | 语义 |
|---|---|
| `trashFile { hash }` | 移入回收站（保留磁盘内容） |
| `restoreFile { hash }` | 从回收站恢复 |
| `purgeFile { hash }` | 永久删除单个条目 |
| `emptyTrash {}` | 永久删除全部回收站条目 |
| `restoreAll {}` | 恢复全部回收站条目 |
| `listFiles { status?: 'active' \| 'trashed' \| 'all' }` | 默认 `active`；`trashed` 按 `deleted_at` 倒序 |
| `getStats` | 结果新增 `trashFiles`、`trashSize` |

删除 `deleteFile`、`hard` 参数与 `ListQuery.includeDeleted`。

- 理由：`hard` 布尔参数把两种不可逆性完全不同的操作塞进一个方法，UI 和日志都无法区分；显式命名让事件广播和测试一目了然。
- 备选：保留 `deleteFile` 作为 `trashFile` 的别名。由于 app 与扩展同版本发布、没有外部消费者，不需要兼容层。
- **BREAKING**：协议方法名与事件名变更，app 与扩展必须同版本发布。

### D3. 存储生命周期与删除顺序

```
trashFile:   UPDATE files SET is_deleted=1, deleted_at=now, updated_at=now
restoreFile: UPDATE files SET is_deleted=0, deleted_at=NULL, updated_at=now
purgeFile:   ① ThumbnailStorage.deleteByHash(hash)   （<hash>-*.jpg，含 -frame）
             ② BlobStorage.deleteBlob(hash, blob_ext)（不存在视为成功）
             ③ purgeHook(hash, metadata)              （归档副本，best-effort）
             ④ 事务内 DELETE tasks + DELETE files 行
             ⑤ recomputeTagUsage()
```

- 顺序必须先磁盘、后 DB 行：如果先删行，磁盘清理失败会留下孤儿 blob，而 `syncBlobsToIndex` 会把孤儿重新索引成活跃文件（"删除后复活"）；先删磁盘即使 DB 失败，最坏结果是回收站里出现一个缩略图缺失的条目，可再次执行永久删除。
- `purgeFile` 对不存在的 hash 幂等返回成功。
- `emptyTrash`：先收集全部回收站 hash，逐条做磁盘与归档清理（归档失败只记录，不阻塞），再在一个事务中删除所有 `tasks` / `files` 行，最后一次性 `recomputeTagUsage()`。
- 缩略图删除按 hash 前缀扫描 `thumbnails/` 目录，兼容 `-100/-200/-400` 与 `-frame` 文件，避免硬编码尺寸列表。
- blob/缩略图缺失均视为成功（幂等）；只有数据库写入失败才返回 `success: false`。

### D4. 归档集成：purge hook + restore hook

VFS 不知道归档目标路径（归档配置属于 app 的 `ConfigStore`），因此 app 通过两个可选钩子参与生命周期：

- `setPurgeHook((hash, metadata) => void | Promise<void>)`：在删 DB 行之前调用，app 实现为删除 `<target>/<hash>.<ext>`。目标未启用、路径无效或文件不存在时静默跳过；失败只记录警告。仅清理**当前**归档目标；历史目标目录无法定位（state 文件不保存历史），作为已知限制。
- `setRestoreHook((hash) => void | Promise<void>)`：在恢复成功后调用，app 实现为在归档启用时 `mediaArchive.enqueue(hash)`。`emptyTrash` / `restoreAll` 不需要逐条钩子，`restoreAll` 逐 hash 调用可接受（恢复数量通常有限）。
- **在途复制竞争**：归档 worker 的 `copyOne` 完成落盘后重新读取 metadata；如果行已不存在（被永久删除），立即删除刚写入的目标文件。被移入回收站（行仍存在，`is_deleted=1`）时保留副本。
- **归档“单向”语义改写**：更新、移入回收站不改动目标；只有永久删除会移除归档副本。

备选：由 app 的 external handler 完全接管删除方法。但 `emptyTrash` 需要逐条清理，控制流会被拆散；钩子让 VFS 保持存储主流程、app 只注入归档这一小步，和现有 `setIngestHook` 模式一致。

### D5. 任务挂起：claim 时过滤回收站目标

`claimTasks` 的 SQL 增加：

```sql
AND EXISTS (SELECT 1 FROM files f WHERE f.hash = tasks.target_hash AND f.is_deleted = 0)
```

- 移入回收站时任务保持原状态（pending / failed / completed），只是不再被领取；恢复后自动重新可领取，无需重建任务或丢失 attempts。
- 队列状态计数（pending / failed 等）同样排除目标在回收站中的任务，避免任务控制台出现永远不消化的积压；恢复后计数自然回升。
- 永久删除时 `hardDeleteFile` 删除该 hash 的全部任务。
- 备选：移入回收站时主动取消任务、恢复时按需重建。会丢失任务状态，且 `restoreAll` 需要重新推导应建哪些任务，复杂度更高。
- 边界：移入回收站时已经在 `processing` 的任务允许完成或失败；若 AI 读取层因 `is_deleted=1` 返回 null 导致失败，任务会进入退避并在恢复后继续重试。这是可接受的低概率竞态。

### D6. 重复采集自动恢复

`saveFile` / `saveFileFromStream` 命中已存在行时：

- 若 `existing.is_deleted === 0`：保持现有 `{ duplicate: true }` 行为。
- 若 `existing.is_deleted === 1`：调用恢复逻辑，返回 `{ duplicate: true, restored: true }`。
- `ingestHook` 在恢复时也会被调用（携带 `restored: true`），app 据此广播 `file:restored` 而不是 `file:captured`；AI/归档入队保持幂等，不会重置已完成任务。
- 备选：仅返回 `trashed` 标志让 UI 提示。多一层提示逻辑，且用户仍需手动去回收站；自动恢复更符合"重新截图就应该回来"的直觉。

### D7. Options 回收站页面

- `tabs.ts` 的 `CONSOLE_TABS` 增加 `'trash'`，`App.tsx` 的 `NAV_ITEMS` 与 section 列表各增加一项（`DeleteOutlined`，标签「回收站」），`#trash` 深链自动可用。
- 新增 `TrashPage`，复用 `VirtualMasonryGrid`、`MediaDetail` 与媒体浏览样式；数据通过 `useHistoricalImages({ status: 'trashed' })` 获取，分页与无限滚动复用现有实现。
- 页面头部：「回收站」标题、条目数与占用、`恢复全部`、`清空回收站`。两项批量操作都需要确认框，永久删除的文案明确写出"不可恢复，归档副本也会被删除"。
- `MediaDetail` 增加回收站模式：隐藏标签编辑、收藏、重跑任务，替换为「删除于 …」「恢复」「永久删除」。
- 媒体库的删除文案改为「移入回收站，可稍后恢复」。
- 事件联动：媒体库监听 `file:trashed` 移除条目、`file:restored` 刷新；回收站页在 `file:purged` / `trash:emptied` / `trash:restored-all` / `file:restored` 后刷新列表。不引入导航角标（尚未被要求，避免额外的全局计数刷新链路）。

### D8. 性能与索引

- schema 常量新增 `CREATE INDEX IF NOT EXISTS idx_files_trash ON files(deleted_at) WHERE is_deleted = 1;`。由于 `initializeSchema` 每次启动都会执行 `CREATE INDEX IF NOT EXISTS`，已有数据库无需单独迁移步骤。
- `trashFile` / `restoreFile` / `purgeFile` / `emptyTrash` / `restoreAll` 结束后调用 `recomputeTagUsage()`，消除 `tags.usage_count` 漂移（该函数已按 `is_deleted=0` 统计）。
- `listFiles` 在 `status='trashed'` 时默认按 `deleted_at` 倒序，`orderBy` 联合类型增加 `'deleted_at'`。

### D9. 事件

| 事件 | 载荷 | 触发 |
|---|---|---|
| `file:trashed` | `{ hash, deletedAt }` | 移入回收站成功 |
| `file:restored` | `{ hash, restoredAt }` | 恢复成功（含重复采集自动恢复） |
| `file:purged` | `{ hash }` | 永久删除单个条目 |
| `trash:emptied` | `{ count }` | 清空回收站完成 |
| `trash:restored-all` | `{ count }` | 恢复全部完成 |

移除 `file:deleted`。回收站 RPC 由 app 的 external handler 处理并在成功后把事件写入 app 事件总线，再由 WebSocket 服务转发给客户端；重复采集自动恢复由 ingest hook 写入同一总线。

### D10. 迁移与回滚

- 无数据迁移：不增删列、不重写行。历史 `is_deleted=1` 行就是回收站初始内容。
- 回滚：旧版本 app 仍能读取同一数据库；它会把回收站条目继续当作"软删除"隐藏，不会误删或复活数据。已永久删除的内容无法回滚（符合语义）。

## Risks / Trade-offs

- **磁盘不会立即释放** → 移入回收站只释放索引空间；回收站页面展示占用，用户通过清空或逐项永久删除释放。符合手动清理的产品决策。
- **归档副本删除可能失败**（网络卷不可达、权限）→ best-effort，记录警告；本地删除仍然成功。可能在归档目录留下副本。
- **旧归档目标目录残留** → 只清理当前 target；历史路径不可追踪。写入 docs/spec 的已知限制。
- **在途归档复制竞争** → 落盘后重新检查源行是否存在，不存在则删除目标文件；窗口仍然极窄。
- **永久删除时 DB 写入失败** → 磁盘已清理但行仍在，条目变成"残缺回收站项"；再次永久删除即可完成（幂等）。
- **回收站内容仍可通过 hash 读取**（HTTP / `getFile`）→ 这是回收站预览与恢复的必要条件；不属于安全边界，文档中说明。
- **事件名破坏性变更** → app 与扩展同版本发布；旧扩展连接新 app 会收不到 `file:deleted`，需要重启加载新扩展。
- **重复采集自动恢复可能出乎意料** → 仅在内容完全一致（同 hash）时触发，且广播 `file:restored` 让 UI 可见。

## Migration Plan

1. 发布 app：schema 初始化自动创建回收站索引；历史软删除行即刻出现在回收站。
2. 发布扩展：切换删除调用为 `trashFile`，新增回收站页面与事件监听。
3. 无需手动迁移命令；建议在 release notes 中说明"之前删除的内容现在可以在回收站中恢复或永久删除"。
4. 若需回滚：恢复旧版 app 即可，数据库结构兼容；回收站数据保持为软删除状态。

## Open Questions

- 无阻塞项。导航角标数量、自动过期策略、批量导出回收站内容均明确不在本期范围。
