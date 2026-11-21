## Context

当前实现（已核对代码）：

- Ollama 设置分散：地址、视觉模型、输出语言在设置页的「Ollama 设置」卡片（`packages/extension/src/entrypoints/options/App.tsx`）；并发数与运行/暂停开关在任务页的共享「任务调度」卡片（`components/TaskConsole.tsx`）。
- `AppConfig` 只有一个 `classificationConcurrency`（默认 1）和一个 `classificationPaused`（默认 true）。调度器用它在全局范围内 claim `classify` + `rename` 任务（`packages/app/src/scheduler.ts`）。
- `OllamaClient.callVision` 直接 `fetch`，没有任何请求级限制。健康检查与模型列表同样直接打 `/api/tags`，可以与视觉请求并发（`packages/ai/src/ollama-client.ts`）。
- 本地 Ollama 通常串行处理请求；客户端并发发出多个请求时，后发请求会在服务端排队，而 `AbortSignal.timeout` 从 `fetch` 发出时开始计时，排队时间被计入超时。
- 媒体归档 runner 每次只 `claimTasks(1)`，并用一个 `running` 布尔锁保证严格串行（`packages/app/src/media-archive.ts`）。
- 现有规格 `task-queue`、`app-task-scheduler` 都明确要求"所有任务共享一个全局并发上限"，本次要替换这一模型。

约束：

- 应用与扩展同版本发布，但可能存在短暂的版本错配；RPC 需要保留过渡别名。
- 配置持久化在 workspace 的 `config.json`，并支持从 extension legacy `chrome.storage` 一次性导入。
- 暂不引入多执行器或分布式调度；app 进程是唯一调度器。

## Goals / Non-Goals

**Goals:**

- 在 `OllamaClient` 内建立 `/api/chat` 的请求级并发不变量，默认 1，动态可调。
- 让 `classify`、`rename`、`archive` 各自拥有独立的运行/暂停与并发上限。
- 提供清晰的配置迁移：旧全局并发 → Ollama Chat 并发；旧全局暂停 → 两个 AI 任务的暂停。
- 把 Ollama 连接/调用配置集中到一个独立卡片，任务页按任务拆分控制与维护动作。
- 保持提示词模板与任务的绑定关系不变。

**Non-Goals:**

- 不新增一级导航；Ollama 仍是设置页内的卡片。
- 不为归档新增 `mediaArchivePaused` 字段；沿用现有 `mediaArchiveEnabled` 作为其运行/暂停开关。
- 不暴露请求超时配置，也不做请求取消/抢占；暂停时已发出的请求继续完成。
- 不实现跨任务类型的统一优先级；优先级只在同一任务类型内部生效。
- 不新增 "等待 Ollama" 的独立计数 API；任务卡继续以调度器槽位口径显示"处理中"。

## Decisions

### Decision 1: Chat 信号量放在 `OllamaClient`，只包住 `/api/chat`

**选择**：在 `packages/ai/src/semaphore.ts` 新增一个 FIFO `AsyncSemaphore`，由 `OllamaClient` 持有，容量来自 `maxConcurrency`（默认 1）。`callVision` 在发送请求前 `await acquire()`，在 `finally` 中 `release()`。`checkHealth` / `listModels` 不经过信号量。

**Rationale**：
- 客户端是唯一的 Ollama 出口，把限制放在这里才能成为真正的"所有 chat 调用"不变量，而不是只约束调度器此刻的调用。
- `/api/tags` 是轻量控制面请求，5 秒超时；如果也排在 60 秒的视觉请求后面，健康状态会长时间陈旧。
- `AbortSignal.timeout` 必须在拿到槽位后创建，才能让排队时间不计入请求超时。

**Alternatives**：
- 只改调度器并发：无法约束未来的非任务调用，也不是请求级保证。
- 限制所有 Ollama 请求：语义最严格，但健康检查会被长请求拖住。

### Decision 2: 一个全局 Chat 闸门 + 每类任务配额

**选择**：`ollamaMaxConcurrency` 是 chat 请求总闸；`classifyConcurrency` / `renameConcurrency` 是调度器为每类任务保留的槽位数。实际 chat 并发是两者共同作用的结果。

**Rationale**：总闸保护 Ollama 容量，任务配额决定每类任务的预处理/排队并行度。两者职责不同，UI 文案需要说明"任务处理中包含等待 Ollama 的任务"。

**Alternatives**：
- 只保留每类任务配额：没有一个统一的提供方容量保护。
- 只保留全局上限：无法独立调整分类/重命名的调度并行度，也不满足用户要求。

### Decision 3: 调度器改为"常驻循环 + 按类型状态表"

**选择**：调度器在 app 启动时始终 `start()`；`tick()` 遍历已注册的 AI 任务类型，跳过已暂停的类型，按各自空闲槽位分别调用 `claimTasks(free, [type])`。状态从单一 `concurrency` 改为按类型的 `{ state, processing, concurrency }`。

```ts
for (const type of this.handlers.keys()) {
  if (this.pausedByType[type]) continue;
  const free = this.concurrencyByType[type] - this.processingCount(type);
  const tasks = this.api.claimTasks(free, [type]);
  // dispatch
}
```

**Rationale**：
- 每类任务有独立保留槽位，互相不会因为对方积压而饿死。
- 暂停只影响 claim，已在飞任务自然完成，符合现有暂停语义。
- 不引入多个调度器实例，也不需要修改 SQLite 的 claim SQL；两次同步的 `claimTasks` 调用各自是原子的。

**Alternatives**：
- 为每个任务类型启动独立调度器：实现更重，会产生多组定时器和状态事件。
- 扩展 `claimTasks` 支持按类型限额的单条 SQL：公平性更精细，但需要改 VFS 查询和测试，收益不大。

### Decision 4: 配置字段与迁移在合并默认值之前完成

**选择**：新增以下字段，并删除 `classificationConcurrency` / `classificationPaused`：

```ts
ollamaMaxConcurrency: number;    // 1–8, default 1
classifyConcurrency: number;     // 1–8, default 1
renameConcurrency: number;       // 1–8, default 1
mediaArchiveConcurrency: number; // 1–8, default 1
classifyPaused: boolean;         // default true
renamePaused: boolean;           // default true
```

迁移在 `ConfigStore.load()` 与 `importLegacy()` 中、**合并 `DEFAULT_APP_CONFIG` 之前**执行：

```ts
raw.ollamaMaxConcurrency ??= raw.classificationConcurrency;
raw.classifyPaused ??= raw.classificationPaused;
raw.renamePaused ??= raw.classificationPaused;
```

新字段存在时始终优先。迁移后删除旧键，持久化时只写新结构。

**Rationale**：如果先合并默认值，默认的 `classifyPaused = true` 会遮蔽旧配置里的 `classificationPaused = false`，导致迁移失效。把迁移放在合并之前可以避免这个陷阱。

**Alternatives**：
- 在 `normalizeAppConfig` 里迁移：调用方必须先保留原始键；容易在 `{ ...DEFAULT, ...parsed }` 之后丢失。
- 保留旧字段作为别名：配置结构长期分裂，UI 仍需判断用哪个。

### Decision 5: 归档沿用 `mediaArchiveEnabled`，runner 改为并发池

**选择**：不新增 `mediaArchivePaused`。`mediaArchiveEnabled` 同时表示"启用归档"和"归档任务运行"：关闭时停止 claim、停止为新文件入队；重新启用时 `becameEnabled` 触发 `reconcile()` + `runOnce()`，按游标补齐关闭期间的文件。

`drainTasks` 从严格串行改为并发池：

- 维护 `inFlight: Map<hash, Promise>`，并发上限读取 `mediaArchiveConcurrency`。
- 用一个 `draining` 守卫保证同一时间只有一个 drain 循环；循环内按空闲槽位 claim，spawn 任务后继续填充，直到达到 `maxTasksPerDrain` 或没有可处理任务，最后等待当前批次完成。
- `running` 状态改为 `draining || inFlight.size > 0`。
- `copyOne` 的临时文件名以 hash 区分，不同 hash 并发复制是安全的。

**Rationale**：归档已经有独立的启用开关，再加一个暂停开关会让 UI 出现两个含义重叠的控件；现有"关闭后重新启用会补齐"的语义已经覆盖暂停需求。并发池保持单一 drain 循环，避免多个定时器同时 claim 的复杂度。

**Alternatives**：
- 新增 `mediaArchivePaused`：语义更统一，但需要两个开关和一组新状态。
- 保持串行：用户的每任务并发需求无法满足。

### Decision 6: 保留旧 start/pause RPC 作为过渡别名

**选择**：新增 `setTaskPaused { taskType, paused }`。同时保留 `startClassification` / `pauseClassification`，行为改为对 `classify` 和 `rename` 同时生效，返回新的 `SchedulerStatus`。

**Rationale**：扩展与 app 同版本发布，但仍可能短暂错配；别名成本很低，可以避免升级过程中旧扩展调用新 app 时失败。

**Alternatives**：
- 直接删除旧 RPC：结构更干净，但升级窗口内会报错。

### Decision 7: UI 结构

- 设置页「Ollama」卡片：Ollama 健康状态 + 检查按钮、地址、视觉模型 + 刷新、输出语言、Chat 最大并发数。VFS 状态仍留在「服务状态」卡片。
- 任务页：删除共享「任务调度」卡片；`TaskConsole` 的每个 AI 任务卡包含运行/暂停开关、最大并发数、处理中/配额、进度、提示词模板、按类型维护动作。
- 归档卡：启用开关（充当运行/暂停）、最大并发数、目标目录、扫描间隔、整体进度、立即归档。
- 维护动作按类型调用已有的 `retryFailed(taskType)`、`requeueAll([taskType])`、`clearQueue(taskType)`。

## Risks / Trade-offs

- **迁移被默认值遮蔽** → 迁移必须在合并默认值之前执行；为 `config.json` 和 `importLegacy` 两条路径都写测试。
- **信号量泄漏导致 chat 永久卡住** → `release` 放在 `finally`；测试抛错路径。
- **动态调小容量** → 已在飞的请求允许完成，新请求等待；不强制取消。
- **任务处理中数字包含等待 Ollama 的任务** → UI 文案说明口径；如后续需要，再增加独立的 in-flight/queued 计数。
- **归档并发过高拖慢 NAS/机械盘** → 默认 1，范围上限 8，由用户显式调高。
- **每类任务保留槽位后，跨类型优先级不再生效** → 这是有意的取舍；同类型内部仍按 priority + created_at 排序。
- **归档关闭期间新文件不在任务表中** → 重新启用会通过 reconcile 补齐；需要在 UI 文案中说明。
- **旧版本回滚** → 旧 app 读不到旧字段时会回落到默认（并发 1、暂停），不会崩溃，但运行状态会改变；在迁移说明中注明。

## Migration Plan

1. 在 `types.ts` 增加新字段、默认值和归一化函数；实现旧字段迁移辅助函数。
2. `ConfigStore.load()` / `importLegacy()` 在合并默认值前调用迁移。
3. `OllamaClient` 增加信号量与 `maxConcurrency` 配置；`index.ts` 的 `applyConfig` 同步更新。
4. 调度器改为按类型并发/暂停；app handlers 增加 `setTaskPaused`，保留旧别名。
5. 归档 worker 改为并发池，配置与状态暴露并发数。
6. Extension 镜像类型、Background relay、`vfs-ws-client`、Options UI 同步更新。
7. 运行 `pnpm test`、`pnpm lint`、`pnpm build`；手工验证旧 `config.json` 迁移和扩展 legacy 导入。

回滚策略：代码回滚即可；配置文件中旧字段已被新字段替代，旧版本会使用默认值。不需要数据库迁移。

## Open Questions

无阻塞项。后续可选增强：在任务卡显示"等待 Ollama"计数，或把 Chat 请求超时暴露为配置项；本次均不做。
