## Why

当前 Ollama 相关设置分散在「设置」与「任务」两个区域，且唯一的并发数位于任务页，语义是"同时处理多少个任务"，不是"同时发多少个 Ollama 请求"。`OllamaClient` 本身没有请求级限制，健康检查和模型列表还可以绕过调度器与视觉请求并发。本地 Ollama 通常串行处理请求，客户端同时发出多个请求时，后发的请求会在服务端排队，而 `AbortSignal.timeout` 从发出时就开始计时，容易出现"Ollama 明明可用、任务却超时重试"。

同时，AI 分类与 AI 重命名共用一个全局运行开关和并发数，无法独立暂停或调整；媒体归档 runner 又是严格串行。用户需要更清晰的分层控制：一个 Ollama Chat 总闸，加上每类任务各自的运行/暂停与并发数。

## What Changes

- **Ollama 独立卡片**：在 Options 设置页将 Ollama 卡片作为连接与调用的唯一配置区域，集中地址、视觉模型、输出语言和全局 Chat 并发数。
- **Ollama Chat 最大并发数**：新增 `ollamaMaxConcurrency`（默认 `1`，范围 `1–8`），只限制 `POST /api/chat`；`GET /api/tags`（健康检查、模型列表）不受限。由 `OllamaClient` 内的 FIFO 信号量强制执行，拿到槽位后才创建超时信号，排队时间不计入请求超时；配置变更可动态调整容量。
- **按任务类型独立控制**：`classify`、`rename`、`archive` 各自拥有独立的运行/暂停状态与最大并发数。
  - `classifyConcurrency`、`renameConcurrency`、`mediaArchiveConcurrency`：默认 `1`，范围 `1–8`。
  - `classifyPaused`、`renamePaused`：默认 `true`。
  - 暂停某类任务只停止 claim 新任务，已在飞任务允许完成；暂停期间仍正常入队；三类互不影响。
  - 媒体归档沿用现有 `mediaArchiveEnabled` 作为其独立运行/暂停开关，不新增 `mediaArchivePaused`；重新启用时通过 reconcile + `runOnce` 补齐关闭期间的文件。
- **媒体归档并发**：归档 runner 从严格串行（`running` 布尔 + `claimTasks(1)`）改为按空闲槽位并发 claim 与复制。
- **任务页重组**：删除共享「任务调度」卡片；每个任务卡内提供运行/暂停、最大并发数、进度；AI 分类/重命名卡保留提示词模板；维护动作按任务类型拆分到各卡（重试失败、全量重扫、清空本类队列），归档保留「立即归档」。
- **配置迁移**：旧 `classificationConcurrency` 迁移为 `ollamaMaxConcurrency`；旧 `classificationPaused` 同时迁移为 `classifyPaused` 和 `renamePaused`；三个任务并发默认 `1`。同时覆盖 app 的 `config.json` 与 extension legacy `chrome.storage` 导入路径。
- **BREAKING** RPC/状态：`startClassification` / `pauseClassification` 改为按 `taskType` 的启动/暂停；`SchedulerStatus` 改为按类型提供 `state` / `processing` / `concurrency`；`MediaArchiveStatus` 暴露并发数；extension 镜像同步更新。
- **保持不变**：提示词模板仍跟随 `classify` / `rename` 任务卡；归档仍然独立于 Ollama 可用性运行。

## Capabilities

### New Capabilities

无。本次变更是在既有能力上调整配置、调度和 UI 行为。

### Modified Capabilities

- `app-config-store`: 新增 Ollama Chat 并发数、三类任务并发数与按类型的暂停字段；定义旧字段迁移与范围归一化。
- `ollama-classifier`: 新增 `/api/chat` 请求级最大并发数的要求，明确排队、超时与动态调整语义。
- `app-task-scheduler`: 将单一全局并发与单一运行意图，改为按任务类型分别 claim、暂停和上报状态。
- `task-queue`: 将全局并发限制与全局暂停语义，改为按任务类型的并发上限与独立暂停语义。
- `media-archive-sync`: 新增归档任务并发数与按空闲槽位并发复制；明确 `mediaArchiveEnabled` 同时作为归档任务的运行/暂停开关。
- `extension-options-config`: 更新 Ollama 设置、任务控制、队列维护与任务分组的 UI 要求。
- `extension-classify-controls`: 将全局启动/暂停控制改为按任务类型的启动/暂停，并更新维护动作作用域。
- `classification-progress-display`: 进度条的运行/暂停状态改为读取对应任务类型的调度状态。

## Impact

- **ai 包**：`packages/ai/src/ollama-client.ts`（chat 信号量、动态容量、超时时机）、`packages/ai/test/ollama-client.test.ts`。
- **app 包**：`packages/app/src/types.ts`（配置字段、默认值、归一化与旧字段迁移）、`config-store.ts`（加载/导入兼容）、`scheduler.ts`（按类型并发与暂停）、`media-archive.ts`（并发 drain、状态与配置更新）、`handlers.ts`（按类型暂停 RPC、归档并发 RPC）、`index.ts`（启动/配置应用）。
- **Extension**：`packages/extension/src/shared/extension-runtime.ts`（镜像类型与事件）、`entrypoints/background/index.ts`（按类型暂停消息与镜像）、`background/vfs-ws-client.ts`（新 RPC）、`entrypoints/options/App.tsx`、`components/TaskConsole.tsx`、`components/MediaArchiveCard.tsx`、`hooks/useTaskQueue.ts`、`hooks/useOptionsData.ts`。
- **规格**：上述 8 个能力的 delta spec。
- **测试**：Ollama 客户端在飞请求数、调度器按类型配额/暂停、归档并发、配置迁移与归一化、Options 卡片行为。
- **破坏性变更**：持久化字段更名/拆分、调度器 RPC 与 `SchedulerStatus` 结构变化。应用与扩展同版本发布，旧配置通过迁移兼容。
