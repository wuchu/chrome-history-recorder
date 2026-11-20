## Context

归档管道以统一任务表为中心：每个文件一条 `archive` 任务，状态与 AI 分类/重命名并列。

```
ingest ──▶ blobs/<hash>.<ext> + files row
                 │
                 ├─ scheduler.enqueuePair()      classify + rename
                 └─ mediaArchive.enqueue(hash)   archive ──▶ tasks(pending)
                                                              │
        MediaArchiveWorker（独立 runner，5s 轮询）              │
        claimTasks(1, ['archive']) ──▶ 复制到目标目录 ──▶ completed
                 │
                 └─ 失败: updateTaskStatus(failed, retryDelayMs)
                        attempts+1, status 回到 pending, next_run_at 退避
```

关键约束：

- **SQLite 必须留在本地**：SMB 不支持 WAL，WAL 模式的 db 在 SMB 上无法打开。
- **任务表以 `(task_type, target_hash)` 唯一**，每个任务必须挂在某个文件上；"一个归档批任务"无法直接表达。
- **任务重试语义**：`updateTaskStatus({ status: 'failed', retryDelayMs })` 会把 attempts+1，并在 `attempts + 1 >= max_attempts` 时才终止，否则回到 `pending` 并设置 `next_run_at`。
- **AI 调度器的耦合**：`Scheduler.tick()` 在 `classificationPaused` 或 Ollama 不可用时不会消费任务，且默认会 claim 所有类型，因此必须按类型隔离。
- **目标目录是事实来源**：`<hash>.<ext>` 存在且 size 一致即已归档，不需要额外的每文件状态。
- **配置存储在工作区**：`workspace/config.json` 随工作区走。

## Goals / Non-Goals

**Goals:**

- 每个新增媒体在任务页中以「媒体归档」任务出现，具备 pending / processing / completed 状态。
- 归档任务由独立 runner 消费，分类暂停或 Ollama 不可用时照常运行。
- 只归档**首次启用之后**新增的媒体；停用期间新增在重新启用后补齐。
- 目标目录用内容哈希命名，天然去重；复制原子落盘。
- 更换目标目录时，把启用以来已存在的归档任务重置并补齐到新目标。
- 单文件失败无限重试（任务保持 pending + 退避），不阻塞其他文件，也不阻止 app 启动。

**Non-Goals:**

- 不对接云 API；目标必须是已挂载的本地目录。
- 不归档启用前的存量文件。
- 不做删除镜像、重命名同步或双向同步。
- 不复制缩略图、AI 元数据、sidecar 或 EXIF 改写。
- 不使用 AI 生成的可读文件名，不支持按日期/分类分目录。
- 不复用 AI `Scheduler` 消费归档任务，也不修改 `classificationPaused` 对 AI 任务的语义。
- 不支持多个目标目录。

## Decisions

### Decision 1: 归档是统一任务表中的 `archive` 类型，由独立 runner 消费

- ingest 时 `mediaArchive.enqueue(hash)` 向 `tasks` 写入 `task_type='archive'`。
- `MediaArchiveWorker` 以 5 秒轮询 `api.claimTasks(1, ['archive'])`，一次只处理一个文件，避免打满 SMB 带宽。
- AI `Scheduler` 的 claim 改为只取自己注册的 handler 类型（`classify` / `rename`），因此不会误领归档任务。
- 归档 runner 不依赖 `running` / `ai.isAvailable()`，分类暂停时仍在工作。

**Alternatives considered:**

- 直接注册到 AI `Scheduler`：`classificationPaused` 默认 true 会让整个循环停止，Ollama 不可用时 `tick` 直接返回；排除。
- 只有一个"归档批任务"行：任务表要求 `target_hash` 引用具体文件，无法表达；排除。
- 继续用状态文件记录失败与游标、不落任务表：任务页不可见，与用户诉求不符；排除。

### Decision 2: 入队由 ingest + 增量对账两路组成

- **实时**：`api.setIngestHook` 在保存成功后调用 `mediaArchive.enqueue(hash)`，任务立即入队并触发一次 drain。
- **对账**：worker 启动、启用、以及每隔 `mediaArchiveIntervalMinutes` 分钟，从状态文件中的 `cursor` 开始分页查询 `files.created_at > cursor`，对每个文件 `enqueueTask({ requeue: false })`。`ON CONFLICT DO NOTHING` 保证幂等。
- **基线**：首次启用写入 `activatedAt`，永久固定；游标不会早于 `activatedAt`。
- **换目标**：规范化路径比较发现变化时，把 `cursor` 重置到 `activatedAt`，写入 `requeuePending = true`；对账时用 `requeue: true` 重建/重置任务，完成后清除标记。
- 状态文件 `workspace/media-archive-state.json`：

```jsonc
{
  "version": 1,
  "activatedAt": "2026-11-21T15:00:00.000Z",
  "targetPath": "/Volumes/personal_folder/Private/VFS-media",
  "cursor": { "createdAt": "...", "hash": "..." },
  "requeuePending": false
}
```

- 文件损坏/不可读时安全重建：保留可用字段；`activatedAt` 丢失则以当前时间重建。

**Alternatives considered:**

- 只用 ingest：应用关闭期间不会有捕获，但崩溃可能发生在 ingest 与入队之间；对账兜底。
- 只靠定时扫描：任务页无法体现"每个文件一条任务"的进度，排除。
- 复用 `requeueAll('archive')` 做换目标回填：它会为**所有** files 建任务，违反"只归档启用后新增"，排除。

### Decision 3: 无限重试落在任务引擎上

- 归档任务入队时 `maxAttempts = 1_000_000`，远大于任何现实重试次数。
- 复制失败时调用 `updateTaskStatus({ taskType: 'archive', hash, status: 'failed', error, retryDelayMs })`：
  - attempts + 1；
  - 未达 max → 状态回到 `pending`，`next_run_at = now + delay`；
  - 因此任务在任务页显示为"待处理"，恢复挂载/修复后自动继续。
- runner 自己计算退避：`min(1 小时, 60s × 2^(attempt-1))`。
- 目标目录不可用时不 claim 任务，只更新 `lastError`，任务留在 pending，避免无意义地消耗 attempts。
- 源文件已删除或 blob 缺失：任务直接标记 `completed`（跳过），因为这是永久状态，重试不会成功。

**Alternatives considered:**

- 使用默认 `max_attempts = 3`：失败三次后任务永久 failed，与"无限重试"冲突。
- 在 runner 内维护失败表：与任务状态重复，且任务页看不到重试信息。

### Decision 4: 目标目录本身就是去重状态，复制保持原子

- 目标文件名固定为 `<hash>.<ext>`。
- 已存在且 size 与源一致 → 任务直接 `completed`。
- size 不一致 → 视为损坏，原子覆盖并记录警告。
- 复制写入目标目录内的 `.<hash>.<ext>.part`，完成后 `rename`；失败清理临时文件。
- 使用 `fs.promises.copyFile`，不把大视频读入内存。

### Decision 5: 目标校验与掉线处理

保存配置时与每轮 drain 前各校验一次：绝对路径、已存在、目录、可写、macOS `/Volumes/<name>` 已挂载、不能位于工作区内部；**不自动创建目录**。不可用时本轮不 claim 任务、记录 `lastError`，下一轮重试。

**Why:** NAS 可能临时掉线；静默在挂载点创建目录会把媒体写到本地。

### Decision 6: 配置字段采用扁平命名

`ConfigStore.update` 使用浅合并，沿用现有扁平风格：

```ts
mediaArchiveEnabled: boolean;            // 默认 false
mediaArchiveTargetPath: string;          // 默认 ''
mediaArchiveIntervalMinutes: number;     // 默认 5，范围 1–1440
```

间隔现在表示**对账扫描**周期；任务消费由 5 秒轮询驱动。缺少字段的旧配置按默认值加载。

### Decision 7: 状态、事件与 RPC

- `getMediaArchiveStatus` 返回：

```ts
{
  enabled: boolean;
  targetPath: string;
  intervalMinutes: number;
  running: boolean;
  lastRunAt?: string;
  pendingCount: number;   // 队列中 archive 的 pending + processing
  failedCount: number;    // 永久失败（当前配置下应长期为 0）
  lastError?: string;
}
```

- `updateMediaArchiveConfig`：校验目标 → 持久化 → 重配置 → 返回状态；校验失败不写入。
- `runMediaArchiveNow`：立即对账并触发 drain，**不等待复制完成**；任务页与状态事件报告进度。
- 事件 `media-archive:status` 在配置变化、drain 开始/结束、失败/完成时广播。
- 队列变化通过既有 `queue:updated` 广播，任务页实时更新；归档同时发出 `task:started` / `task:completed` / `task:retrying`。

### Decision 8: vfs 需要三个薄 API

1. `listFilesCreatedAfter({ createdAt, hash, limit })`：按 `(created_at, hash)` 升序的 keyset 查询，排除已删除；新增 `idx_files_created_at`。
2. `getBlobPath(hash)`：返回 `{ path, size, mimeType } | null`，不读取内容（现有 `getFile()` 会把整个 blob 读进内存）。
3. `claimTasks(limit, taskTypes?)`：按类型过滤领取任务，使 AI 调度器与归档 runner 互不抢任务。

### Decision 9: 归档卡片放在任务页，展示整体进度

- 「任务」页顶部渲染「媒体归档」卡片：启用、目标、间隔、整体进度（已完成/总数 + 进度条 + 处理中/待处理/失败）、状态与「立即归档」。
- 整体进度取自 `queue.byType.archive`，随 `queue:updated` 实时刷新；不需要额外的后端统计接口。
- TaskConsole 的按类型卡片**排除 `archive`**，避免与专用卡片重复。
- 任务页的「全量重扫」仍只针对 classify + rename；「清空队列」会删除归档任务，属于显式破坏性操作。

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|---|---|---|
| SMB 带宽/延迟 | 单个大视频复制较慢 | runner 单任务串行、独立于 AI 并发；失败退避 |
| 目标长期不可用 | 任务长期 pending | 不 claim、不消耗 attempts；状态与 lastError 可见 |
| 永久性失败（权限等） | pending 任务长期存在 | 指数退避到 1 小时；任务页可见；用户可清空 |
| 目标文件被外部修改/删除 | 不会自动重新归档已完成任务 | 显式重新触发（换目标或清空后重建） |
| 清空任务队列 | 归档任务丢失且游标已推进 | 属显式操作；可更换目标或手动触发对账（后续可加“重建归档任务”） |
| 启用前存量不归档 | 用户可能误以为全部同步 | Options 文案明确"仅归档启用后新增" |
| 单目标 | 不能同时备份到两处 | v1 明确不支持 |

## Migration Plan

1. launcher 配置切回默认 `~/.vfs-workspace`（或通过 `--workspace` 指定本地工作区）。
2. 在 NAS 上准备一个干净目录（如 `/Volumes/personal_folder/Private/VFS-media/`）。
3. 启动新版本，在 Options「设置 → 媒体归档」中启用、填写目标、设置间隔。
4. 新捕获的文件会以「媒体归档」任务出现在任务页，并按 `<hash>.<ext>` 落到目标目录。
5. 停用后重新启用会补齐停用期间新增；更换目标会重建启用以来的归档任务。

## Open Questions

- 是否提供「重建归档任务」按钮，用于清空队列后重新对账？当前通过更换目标或手动触发实现。
- 是否需要在任务页为 archive 类型增加专用的批量重试/清理操作？当前复用全局按钮。
- 目标目录按日期分目录、使用 AI 文件名等均为后续增强。
