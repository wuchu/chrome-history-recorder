## Why

用户希望把捕获的图片和视频归档到 NAS（SMB 挂载目录）。此前尝试过两种"把存储搬出去"的方案，都不可行：

- **整个工作区放到 SMB**：SQLite 在 SMB 上无法使用 WAL；以 WAL 模式创建/复制过去的 `vfs.db` 在该卷上甚至无法打开，后端启动即失败。
- **`blobs/` 软链到 SMB**：读和图片直写可行，但视频上传走"本地 `.tmp` → `rename` 到 `blobs/`"，跨文件系统会报 `EXDEV`，所有视频捕获失败。

因此改为**本地工作区 + 单向归档**：SQLite 永远留在本地，新增的媒体文件按内容哈希复制到用户指定的挂载目录。这样既满足备份/共享需求，又完全绕开 WAL 与跨设备 rename 的问题。

## What Changes

- 在统一任务表中新增 `archive` 任务类型：每个新增媒体对应一条任务，在 Options 任务页与 classify / rename 并列显示 pending / processing / completed 状态。
- 新增 app 侧的 `MediaArchiveWorker` 作为归档任务 runner：独立轮询 `claimTasks(1, ['archive'])`，一次处理一个文件；不受 `classificationPaused` 或 Ollama 可用性影响。
- ingest 时立即入队；worker 另外按间隔从游标对账，补齐应用重启或崩溃期间遗漏的任务。
- 新增归档配置（存于 workspace 的 `config.json`）：
  - `mediaArchiveEnabled`（默认 `false`）
  - `mediaArchiveTargetPath`（默认空）
  - `mediaArchiveIntervalMinutes`（默认 `5`，范围 1–1440）
- 新增运行期状态文件 `workspace/media-archive-state.json`：首次启用时间、对账游标、换目标时的 requeue 标记；原子写入，损坏时安全重建。逐文件的失败/进度由任务表承载。
- **基线与增量语义**：首次启用时记录 `activatedAt`，此后固定不变；只归档 `created_at` 晚于基线的文件。停用再启用会补齐停用期间新增的文件，但永远不会归档启用前的存量。
- **目标目录语义**：必须是已存在的绝对目录（不自动创建）；每次扫描前校验存在、可写、macOS `/Volumes/<name>` 已挂载；不可用时跳过本轮，不做任何创建或删除。
- **文件命名**：目标目录内扁平存放 `<hash>.<ext>`，内容寻址天然去重；目标已存在且大小一致时跳过。
- **原子落盘**：先写目标目录内的 `.<hash>.<ext>.part`，再 `rename`；失败清理临时文件。
- **失败无限重试**：归档任务的 `max_attempts` 设为极大值，失败时 `updateTaskStatus(failed, retryDelayMs)` 把任务放回 pending 并设置 `next_run_at`；退避指数增长（上限 1 小时），永不终止。目标不可用时不领取任务，避免消耗重试次数。
- **任务隔离**：AI 调度器只领取自己注册的 `classify` / `rename` 任务，归档 runner 只领取 `archive`，互不抢占。
- **更换目标目录**：按规范化路径检测变化，游标重置到 `activatedAt`，把启用以来尚未出现在新目标中的文件全部补齐。
- **只增不删**：源文件删除不会删除目标文件；不做双向同步。
- 新增 app RPC：`getMediaArchiveStatus`（含 `pendingCount` / `failedCount`）、`updateMediaArchiveConfig`、`runMediaArchiveNow`。
- 新增状态事件 `media-archive:status`，并复用既有 `queue:updated` 让任务页实时刷新。
- Options「任务」页新增「媒体归档」卡片：开关、目标路径、间隔、「立即归档」、整体进度（已完成/总数、进度条、处理中/待处理/失败）与错误。
- vfs 新增增量查询、blob 路径访问、按类型领取任务（避免把大视频读进内存、避免 AI 调度器误领归档任务），并为 `created_at` 增加索引。
- 文档补充：本地工作区 + 单向归档的推荐结构、NAS 挂载要求、只同步新增的语义与恢复方式。

无破坏性变更；默认关闭，未启用时行为与现在完全一致。

## Capabilities

### New Capabilities

- `media-archive-sync`: 归档 worker 的启用基线、增量扫描、目标校验、原子复制、失败无限重试、目标切换回填、状态/RPC/事件语义。

### Modified Capabilities

- `app-config-store`: `AppConfig` 新增三个归档字段、默认值与规范化，并随 `getConfig` 暴露。
- `extension-options-config`: Settings 页新增「媒体归档」设置卡片。
- `vfs-service`: 新增按 `(created_at, hash)` 游标查询新文件的 API、blob 绝对路径访问，以及对应索引。

## Impact

- `packages/app/src/types.ts`：归档配置字段、默认值与规范化。
- `packages/app/src/media-archive.ts`（新增）：目标校验、状态文件读写、`MediaArchiveWorker`。
- `packages/app/src/index.ts`：构造并启动 worker，随配置变更重配置，随进程关闭停止。
- `packages/app/src/handlers.ts`：新增归档状态/配置/手动触发 RPC。
- `packages/vfs/src/sqlite.ts`：`listFilesCreatedAfter` 查询、`created_at` 索引、`claimTasks(limit, taskTypes?)` 类型过滤。
- `packages/vfs/src/api.ts`：暴露增量查询、`getBlobPath`（路径而不读入内存）与带类型的 `claimTasks`。
- `packages/app/src/scheduler.ts`：AI 调度器只领取自己注册的任务类型，避免误领 `archive`。
- `packages/extension/src/entrypoints/options/components/TaskConsole.tsx`：新增 `archive` 类型标签与卡片。
- `packages/extension/src/shared/extension-runtime.ts`：`ExtensionConfig` 与默认值补齐归档字段。
- `packages/extension/src/background/vfs-ws-client.ts`：新增状态/配置/手动触发客户端方法。
- `packages/extension/src/entrypoints/options/`：新增「媒体归档」卡片与 hook 状态。
- 测试：`packages/vfs/test/sqlite.test.ts`、`packages/vfs/test/api.test.ts`、`packages/app/test/media-archive.test.ts`（新增）、`packages/app/test/handlers`（如有）、Options hook 测试。
- 文档：`README.md`、`ARCHITECTURE.md`。
- 无新增依赖；不涉及云 API、凭据或新的网络协议。
