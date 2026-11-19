## Context

现状（已核对代码）：

- 扩展 Background 里有一套 `ClassifyScheduler`，每 5s 轮询 VFS，串行调用 `OllamaClient.classifyByHash`（[scheduler.ts](../../../packages/extension/src/background/classify/scheduler.ts)）。
- VFS SQLite 中 `classify_queue(hash UNIQUE, status, priority, retries, error, ...)` 只支持单一分类任务（[sqlite.ts](../../../packages/vfs-service/src/sqlite.ts)）。
- `OllamaClient` 用一次 `/api/chat` 同时产出 `category + tags + ai_filename`，prompt 规定"从可用标签中选 1-3 个"，并过滤词表外的标签（[ollama-client.ts](../../../packages/extension/src/background/classify/ollama-client.ts)）。
- 标签事实源分裂：用户标签定义在 `chrome.storage.local.userDefinedTags`，文件标签是 `files.tags` 里的 JSON 字符串数组。
- 生命周期缺口：没有 `chrome.runtime.onStartup`，manifest 无 `alarms` 权限，没有 stale `processing` 恢复；`retryDelay` / `maxRetries` 是未使用的死代码。
- 现有 spec：`task-queue`、`extension-ai-classify`、`ollama-classifier`、`tag-management` 均按"单一分类"描述，需要改写。

## Goals / Non-Goals

**Goals:**

- 通用任务引擎：`task_type` 可扩展，所有 AI 任务共享一个全局并发上限。
- 跨重启续跑：浏览器重启、SW 中途被回收后都能恢复并继续处理队列。
- AI 自生长标签词表：Ollama 生成标签并判定近义，标签存 VFS SQLite，支持 pinned。
- 分类与重命名作为独立任务，配对入队但互不强耦合。
- 手动 refresh：单文件按类型重排 + 全量重扫。
- 省调用：分类流水线一次视觉调用完成生成与归并。

**Non-Goals:**

- 不做物理文件重命名；blob 保持内容 hash 命名。
- 不引入 embedding 模型做近义召回（当前用 Ollama 文本/视觉判定 + 别名缓存）。
- 不做分类器版本管理或自动重扫（换模型后由用户手动 refresh）。
- 不做多执行器/分布式调度；执行器仍为单个扩展 Service Worker。
- 不做按任务类型的独立并发上限（只有一个全局上限）。

## Decisions

### Decision 1: 执行器留在扩展，队列持久化在 VFS

**选择**：任务执行（调用 Ollama）仍在扩展 Background；任务队列仍持久化在 VFS SQLite。

**Rationale**：用户要求留在扩展内；同时 VFS 是独立 Node 进程，队列天然跨浏览器重启存活，扩展只需要"被唤醒后继续消费"。

**Alternatives**：
- 迁到 VFS Node 进程执行：可靠性最高，但违背用户约束。

### Decision 2: MV3 唤醒与恢复闭环

**选择**：
- 新增 `chrome.runtime.onStartup` 监听，浏览器启动时确保初始化并按运行意图启动引擎。
- 新增 `alarms` 权限，注册周期性唤醒（最小 1 分钟）作为空闲被回收后的兜底。
- 每次 SW 冷启动执行 `recoverStale()`：把 `processing` 任务还原为 `pending`（单 SW 场景下安全）。
- VFS `onConnect` 时再次 kick 引擎。
- 运行意图持久化到扩展配置（沿用并泛化 `classificationPaused`）。

**Rationale**：MV3 SW 会在 30s 空闲后终止；执行中的 `await` 不会被保留。队列在 VFS 侧持久化，恢复只需重新领取任务。运行中的 5s 轮询 WS 往返本身也起到保活作用。

**Alternatives**：
- 仅依赖轮询保活：VFS 断开或空闲时失效。
- 仅 `onStartup`：会话中途回收后不会自愈。

### Decision 3: 统一任务模型 + 全局信号量

**选择**：

```sql
tasks(
  id, task_type, target_hash, status, priority,
  attempts, max_attempts, next_run_at,
  started_at, completed_at, error,
  created_at, updated_at,
  UNIQUE(task_type, target_hash)
)
```

一个 `TaskEngine` 持有全局并发计数器（`concurrency`），每次 tick 领取任意类型的空闲槽位，按 `task_type` 分派到 handler。领取使用条件更新（`UPDATE ... WHERE id=? AND status='pending'`）保证原子性。

**Rationale**：满足"独立任务类型 + 共享并发上限"。单一引擎避免两套调度器争抢本地模型。

**Alternatives**：
- 两张队列表：并发控制会分散，违背共享上限。
- 一个文件一条任务：无法同时排分类与重命名。

### Decision 4: 分类采用"省调用"融合流水线

**选择**：一次视觉调用完成"生成标签 + 词表归并"。prompt 注入 top-N（按 `usage_count`）标签词表，要求模型输出已有 canonical 或 `NEW:` 新标签。写入前做 trim/lower 规范化，并查 `tag_aliases` 命中缓存。

**Rationale**：用户选择省调用模式；对中小词表精度足够。别名缓存吞掉重复候选。

**Alternatives**：
- 两段式（视觉 + 文本归并）：精度更好但每图 2 次调用。
- Embedding 召回：词表极大时更优，但引入新依赖。

**风险**：词表膨胀会污染 prompt 并使近义分裂。缓解：top-N 窗口、规范化、别名缓存、手动合并（见 Decision 6）。

### Decision 5: AI 重命名为独立任务，仅展示名

**选择**：`rename` 任务单独调用一次视觉模型生成 `ai_filename`，写入 `files.ai_filename`；不改磁盘 blob 名。

**Rationale**：blob 是内容寻址（`blobs/{hash}.{ext}`），物理重命名会破坏去重与可恢复性。展示名满足用户需求。

**Alternatives**：
- 物理重命名：破坏内容寻址。
- 与分类合并调用：违背"独立任务可单独重跑"。

### Decision 6: AI 自生长标签词表

**选择**：
- 新增 `tags(id, name, label, usage_count, created_by, is_pinned, created_at, updated_at)`。
- 新增 `tag_aliases(alias PRIMARY KEY, tag_id)` 缓存 Ollama 判定的近义映射。
- `files.tags` JSON 继续作为 UI 过滤的兼容缓存，保存 canonical 标签名，保留 `system:*`。
- 标签写入在单个事务内完成（upsert tags / aliases / 更新 files.tags）。
- `userDefinedTags` 不再是内容标签来源；保留 `pinned` 概念用于固定页签。

**Rationale**：集中式词表才能做近义归并；保留 `files.tags` 让现有 `json_each` 过滤与统计继续工作。

**Alternatives**：
- 纯 `file_tags` 关系表：更规范，但需重写 UI 过滤路径。
- 继续用 `chrome.storage`：无法承载自生长词表与别名的原子写入。

### Decision 7: 幂等与刷新语义（无分类版本）

**选择**：
- 自动入队：`INSERT ... ON CONFLICT(task_type, target_hash) DO NOTHING`。
- 手动单文件 refresh：按 `(hash, task_type)` 重置为 `pending`（即使 completed）。
- 全量 refresh：把所有指定类型的任务重置/补齐为 `pending`。
- 达到 `max_attempts` 的失败任务保持 `failed`，等待手动重试。

**Rationale**：用户不需要自动分类版本管理；手动 refresh 是更换模型后的重扫入口。

### Decision 8: 停写 `category`

**选择**：分类任务不再写 `files.category`；该列保留以避免破坏性 schema 变更。媒体网格徽章改用首要标签。

**Rationale**：标签已能表达分类语义；`category` 与新模型重复。

### Decision 9: 保留 pinned

**选择**：`tags.is_pinned` 决定 Side Panel 页签可见性/顺序；未 pinned 的标签按 `usage_count` 取 top-N 展示。

**Rationale**：AI 自生长标签数量不可控，必须有用户可控的固定页签。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 标签膨胀 / 近义分裂 | top-N prompt 窗口 + 规范化 + 别名缓存 + Options 手动合并；词表极大时记录为已知上限 |
| 并发 > 1 时同义标签竞态 | 单事务写入 + `UNIQUE(name)` + upsert |
| SW 在长推理中途被回收 | 5s 轮询保活 + alarms 兜底 + 启动恢复；恢复后从头重跑（任务幂等） |
| VFS 未启动 | 引擎不启动；onConnect 后自动 kick；UI 显示不可用状态 |
| `files.tags` 与 `tags` 表不一致 | 事务内同时更新；定期或按需重算 `usage_count` |
| 停写 `category` 影响现有 UI/统计 | 徽章改用首要标签；`getStats.byCategory` 标记为遗留 |
| `userDefinedTags` 迁移 | 作为 pinned/页签偏好迁移或忽略；不再注入 prompt |
| alarms 最小间隔 1 分钟 | 接受；运行中由轮询保活，alarms 只作兜底 |
| 本地模型压力 | 全局并发默认 1，用户可在 Options 调整 |

## Data Flow

### 捕获 → 入队

```
capture:media → saveFile → (非 duplicate) → 入队 classify + rename（各自 ON CONFLICT DO NOTHING）
```

### 分类任务

```
claim(classify) → 取 large 缩略图
  → 读取 top-N tags 词表
  → 单次 Ollama vision(prompt: 图 + 词表 + 归并/NEW 指令)
  → 解析 + normalize + 查 tag_aliases
  → 事务：upsert tags / aliases，替换 files.tags（保留 system:*），classified_at=now
  → completed
```

### 重命名任务

```
claim(rename) → 取 large 缩略图
  → Ollama vision(prompt: 命名风格)
  → sanitize → files.ai_filename
  → completed
```

### 唤醒 → 恢复 → 续跑

```
onStartup / alarm / onConnect
  → ensureInit()
  → recoverStale(): processing → pending
  → 若运行意图=running → engine.start()
```
