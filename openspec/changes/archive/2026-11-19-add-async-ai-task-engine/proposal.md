## Why

当前后台 AI 能力只有"分类"一种操作，且被硬编码在单张 `classify_queue(hash UNIQUE)` 表和扩展的 MV3 Service Worker 里，导致：

- 无法把"AI 重命名"作为独立任务运行——它现在和分类挤在同一次 Ollama 调用里，不能单独重跑。
- 一个文件只能排一条任务，分类与重命名无法并存；也没有跨任务类型共享的并发上限，本地模型压力无法统一控制。
- Service Worker 中途被回收时，任务会永久卡在 `processing`；浏览器重启后不会自动续跑（当前没有 `runtime.onStartup`，也没有 `alarms` 权限）。
- 标签只能从固定预定义列表中"选"，不能由 AI 生成；没有近义词归并，数据库里也无法承载一个自生长的标签词表。

本次变更把"单一分类队列"升级为**通用异步 AI 任务引擎**，并把标签体系改为 **AI 自生长词表 + Ollama 近义归并**。

## What Changes

- **统一任务引擎**：引入 `task_type`（`classify` | `rename`），所有 AI 任务共享同一个全局并发上限；任务按 `(task_type, target_hash)` 幂等去重。
- **MV3 唤醒与恢复**：新增 `runtime.onStartup` + `chrome.alarms` 周期性唤醒；启动时把残留 `processing` 还原为 `pending`；VFS 重连时自动 kick 引擎；持久化"运行意图"以支持跨浏览器重启续跑。
- **AI 分类（省调用模式）**：单次融合视觉调用同时完成"生成标签 + 依据词表做近义归并"；允许 AI 创建新标签；用 `tag_aliases` 缓存已判定的近义映射；prompt 只注入 top-N 高频标签。
- **AI 重命名（独立任务）**：独立的 `rename` 任务根据图片内容生成 `ai_filename`，仅作为展示名写入数据库；blob 仍按内容 hash 命名，不做物理重命名。
- **标签词表迁移到 VFS SQLite**：新增 `tags` / `tag_aliases` 表，标签由 AI 自生长；`is_pinned` 支持固定页签；`chrome.storage` 的 `userDefinedTags` 不再作为内容标签来源。
- **停写 `category`**：分类只产出标签；`category` 列保留但不再写入，媒体网格徽章改用首要标签。
- **刷新能力**：支持"单文件按任务类型重排"与"全量重扫"两种手动 refresh。
- **配对入队但解耦**：捕获时同时入队 `classify` 与 `rename`，但两者状态、重试、刷新完全独立。

## Capabilities

### New Capabilities

- `ai-auto-rename`: 独立 AI 重命名任务，根据图片内容生成展示名并写入数据库。

### Modified Capabilities

- `task-queue`: 从"单一分类队列"泛化为"多任务类型 + 全局并发 + 唤醒/恢复"的异步任务引擎。
- `extension-ai-classify`: Background 协调两类任务；捕获时配对入队；分类流水线改为融合词表归并、停写 category。
- `ollama-classifier`: 允许 AI 生成新标签与判定近义；移除"只从预定义标签中选"的限制。
- `tag-management`: 内容标签改由 VFS SQLite 自生长词表承载；新增 pinned、usage、alias 与标签治理 UI。
- `side-panel-media-browser`: 页签改由 VFS 标签词表驱动（含 pinned），移除 classification badge 对 `category` 的依赖。
- `classification-progress-display`: 进度展示扩展为按任务类型的进度，并加入单文件/全量刷新入口。

## Impact

- **Extension**：`entrypoints/background/index.ts`（onStartup/alarms/恢复）、`background/classify/*`（scheduler → 统一引擎、Ollama 融合流水线）、`background/config-manager.ts`（运行意图、移除种子词表依赖）、`background/vfs-ws-client.ts`（typed 任务 API）、`entrypoints/options/App.tsx`（标签治理）、`entrypoints/sidepanel/App.tsx`（页签来源）、`media-browser`（徽章/进度）。
- **VFS Service**：`sqlite.ts`（`tasks` / `tags` / `tag_aliases` schema 与事务）、`api.ts`、`dispatcher.ts`、`websocket-server.ts`（typed 任务方法与事件）。
- **Manifest**：新增 `alarms` 权限。
- **数据迁移**：`classify_queue` → `tasks`；既有 `files.tags` 作为兼容缓存保留；`system:*` 标签保持不变。
- **破坏性变更**：`category` 不再写入；`userDefinedTags` 不再是标签来源。UI 与调用方需同步更新。
