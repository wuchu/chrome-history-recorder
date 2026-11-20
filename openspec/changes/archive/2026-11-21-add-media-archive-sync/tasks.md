## 1. VFS 任务与查询能力

- [x] 1.1 在 `packages/vfs/src/sqlite.ts` 中新增 `idx_files_created_at` 索引
- [x] 1.2 实现 `SQLiteDatabase.listFilesCreatedAfter({ createdAt, hash, limit })`：排除 `is_deleted = 1`，按 `(created_at, hash)` 升序，游标严格大于
- [x] 1.3 为 `claimTasks(limit, taskTypes?)` 增加任务类型过滤，未传类型时保持原有行为
- [x] 1.4 在 `packages/vfs/src/api.ts` 中暴露 `listFilesCreatedAfter`、`getBlobPath`、带类型的 `claimTasks`
- [x] 1.5 更新 `packages/vfs/dist/*` 构建产物
- [x] 1.6 新增/更新 `packages/vfs/test/sqlite.test.ts`：游标分页、并列时间戳、排除删除项、任务类型领取
- [x] 1.7 新增/更新 `packages/vfs/test/api.test.ts`：`listFilesCreatedAfter`、`getBlobPath` 正常与缺失场景

## 2. App 配置

- [x] 2.1 在 `packages/app/src/types.ts` 的 `AppConfig` 中新增 `mediaArchiveEnabled`、`mediaArchiveTargetPath`、`mediaArchiveIntervalMinutes`
- [x] 2.2 默认值 `false` / `''` / `5`，`normalizeAppConfig` 裁剪路径并把间隔夹到 1–1440
- [x] 2.3 缺失字段的旧配置按默认值加载
- [x] 2.4 更新 `packages/extension/src/shared/extension-runtime.ts` 的 `ExtensionConfig`、`DEFAULT_EXTENSION_CONFIG` 与 `MediaArchiveStatus`
- [x] 2.5 新增/更新配置测试：默认值、夹取、旧配置兼容

## 3. 目标校验与状态文件

- [x] 3.1 新增 `packages/app/src/media-archive.ts`
- [x] 3.2 实现 `validateMediaArchiveTarget`：展开 `~`、绝对路径、拒绝根目录/主目录/工作区内部、必须已存在且为目录、可写
- [x] 3.3 实现 macOS `/Volumes/<name>` 已挂载检查；校验失败时绝不创建目录
- [x] 3.4 状态文件 `workspace/media-archive-state.json`：`activatedAt`、`targetPath`、游标、`requeuePending`
- [x] 3.5 状态文件原子写入，损坏时保留可用字段并安全重建
- [x] 3.6 新增测试：校验矩阵、状态读写、损坏恢复

## 4. 归档任务与 runner

- [x] 4.1 定义 `ARCHIVE_TASK_TYPE = 'archive'` 与极大的 `ARCHIVE_MAX_ATTEMPTS`
- [x] 4.2 `MediaArchiveWorker.enqueue(hash)`：启用且配置目标时写入 archive 任务，并广播队列变化
- [x] 4.3 ingest hook 在捕获后调用 `mediaArchive.enqueue(hash)`（与 classify/rename 并列）
- [x] 4.4 独立 runner 每 5 秒 `claimTasks(1, ['archive'])`，一次处理一个文件，不依赖 AI 暂停或 Ollama
- [x] 4.5 AI `Scheduler` 只领取自己注册的 `classify` / `rename` 任务，避免误领 archive
- [x] 4.6 对账：启动、启用与间隔触发时从游标分页 `listFilesCreatedAfter` 幂等入队
- [x] 4.7 首次启用固定 `activatedAt`；停用/重启/重新启用不重置
- [x] 4.8 目标路径变化：游标重置到 `activatedAt`，`requeuePending = true`，对账时以 `requeue: true` 重建任务
- [x] 4.9 目标校验失败时不领取任务，仅记录 `lastError`，任务保持 pending
- [x] 4.10 目标已存在且 size 一致时任务直接完成；size 不一致时原子覆盖并告警
- [x] 4.11 目标目录内 `.<hash>.<ext>.part` + rename 原子复制，失败清理临时文件
- [x] 4.12 复制失败：`updateTaskStatus(failed, retryDelayMs)` → attempts+1、状态回到 pending、`next_run_at` 退避
- [x] 4.13 退避指数增长、上限 1 小时；`max_attempts` 极大，任务永不永久失败
- [x] 4.14 源文件已删除或 blob 缺失：任务标记 completed 并跳过
- [x] 4.15 在 `packages/app/src/index.ts` 中构造 worker、启动、随配置变更重配置、随进程关闭停止
- [x] 4.16 归档失败不得阻止 app 启动或影响 HTTP/WebSocket 服务
- [x] 4.17 新增 `packages/app/test/media-archive.test.ts`：任务入队/完成、只同步新增、跳过已存在、失败退避重试、目标缺失、删除源、换目标回填、状态事件

## 5. RPC 与事件

- [x] 5.1 `getMediaArchiveStatus` 返回 enabled/targetPath/interval/running/lastRunAt/pendingCount/failedCount/lastError
- [x] 5.2 `updateMediaArchiveConfig`：校验目标 → 持久化 → 重配置 → 返回状态；校验失败不写入
- [x] 5.3 `runMediaArchiveNow`：立即对账并触发 drain，不等待复制完成
- [x] 5.4 广播 `media-archive:status`，并复用 `queue:updated`、`task:started` / `task:completed` / `task:retrying`
- [x] 5.5 新增 handler 测试：状态查询、合法保存、非法目标拒绝、手动触发

## 6. 扩展传输层与 UI

- [x] 6.1 `vfs-ws-client.ts` 新增状态/配置/手动触发方法与类型
- [x] 6.2 Background 中继新增对应消息分支，字段只增不改
- [x] 6.3 `useOptionsData` 新增归档状态、保存、手动触发与 `media-archive:status` 实时订阅
- [x] 6.4 任务页顶部新增「媒体归档」卡片（开关、目标、间隔、整体进度、状态、立即归档）
- [x] 6.5 卡片整体进度：已完成/总数、进度条、处理中/待处理/失败，随 `queue:updated` 刷新
- [x] 6.6 卡片文案说明"仅归档首次启用后新增"、"根据内容哈希命名"、"每个文件是一条任务"
- [x] 6.7 `TaskConsole` 从按类型卡片中排除 `archive`，避免与专用卡片重复
- [x] 6.8 新增 Options 测试：状态渲染、整体进度、保存、切换、运行中禁用、失败/待处理计数

## 7. 文档

- [x] 7.1 `README.md` 新增「媒体归档」章节：启用、目标要求、hash 命名、只同步新增、任务页可见、换目标回填、失败重试
- [x] 7.2 `ARCHITECTURE.md` 说明本地工作区 + 单向归档，以及为什么不推荐 SMB 工作区/软链 blobs
- [x] 7.3 说明归档场景应回到默认 `~/.vfs-workspace`

## 8. 验证

- [x] 8.1 `pnpm build` 通过
- [x] 8.2 `pnpm test` 通过
- [x] 8.3 `pnpm lint` / `format:check` 通过
- [x] 8.4 真实 SMB：图片与视频以 `<hash>.<ext>` 落盘，任务完成、无 `.part` 残留
- [x] 8.5 真实 SMB：目标目录消失时跳过且不重建，恢复后补齐
- [x] 8.6 真实 SMB：更换目标后，启用以来的文件补到新目标
- [x] 8.7 真实 SMB：源文件缺失时任务失败可见、后续文件不受影响、恢复后重试成功
