## 1. VFS 数据模型与迁移

- [x] 1.1 在 `sqlite.ts` 新增 `tasks(task_type, target_hash, ..., UNIQUE(task_type, target_hash))` schema
- [x] 1.2 新增 `tags(id, name, label, usage_count, created_by, is_pinned, ...)` 与 `tag_aliases(alias, tag_id)` schema
- [x] 1.3 将既有 `classify_queue` 数据迁移到 `tasks(task_type='classify')`，并保留 `files.tags` 作为兼容缓存
- [x] 1.4 实现 typed 任务方法：`enqueueTask` / `claimTasks` / `updateTaskStatus` / `requeueTask` / `requeueAll`
- [x] 1.5 实现 `recoverStaleProcessingTasks()`（processing → pending）
- [x] 1.6 实现标签事务：`upsertTagsAndAliases` + 替换 `files.tags` 时保留 `system:*`

## 2. VFS API 与事件

- [x] 2.1 在 `api.ts` 暴露 typed 任务与标签词表方法（enqueue/claim/status/requeue/tagCounts/tags/list/merge/pin）
- [x] 2.2 在 `dispatcher.ts` 注册新方法
- [x] 2.3 在 `websocket-server.ts` 增加任务状态事件（携带 `task_type`）与标签词表变更事件

## 3. 扩展：统一任务引擎

- [x] 3.1 把 `ClassifyScheduler` 重构为 `TaskEngine`：全局并发信号量 + 按 `task_type` 分派
- [x] 3.2 实现 `ClassifyHandler`（融合视觉调用：生成 + 词表归并 + 别名缓存）
- [x] 3.3 实现 `RenameHandler`（视觉调用生成 `ai_filename`）
- [x] 3.4 实现失败退避（`attempts` / `next_run_at` / `max_attempts`），移除死代码 `retryDelay`/`maxRetries`
- [x] 3.5 捕获时配对入队 `classify` 与 `rename`（`ON CONFLICT DO NOTHING`，互不依赖）

## 4. 扩展：唤醒与恢复

- [x] 4.1 在 `wxt.config.ts` 增加 `alarms` 权限
- [x] 4.2 在 `background/index.ts` 注册 `runtime.onStartup` 与周期性 alarm
- [x] 4.3 SW 冷启动时执行 `recoverStale`，并按持久化运行意图决定是否启动引擎
- [x] 4.4 VFS `onConnect` 时 kick 引擎
- [x] 4.5 更新 start/pause 消息处理以驱动统一引擎并持久化运行意图

## 5. 扩展：AI 分类与重命名逻辑

- [x] 5.1 重写 `buildPrompt`：注入 top-N 词表，允许 `NEW:` 新标签，移除"只从预定义中选"
- [x] 5.2 实现标签解析、normalize、`tag_aliases` 命中与 `tags` 事务写入
- [x] 5.3 分类停写 `category`，仅写 `tags` / `confidence` / `classified_at` / `model_used`
- [x] 5.4 新增独立的 rename 调用与 `ai_filename` 写入（仅展示名）
- [x] 5.5 移除 `OllamaClientConfig.userDefinedTags` 作为 prompt 词表来源

## 6. 扩展：UI

- [x] 6.1 Side Panel 页签改由 VFS 标签词表驱动（pinned + top usage）
- [x] 6.2 MediaGrid 徽章改用首要标签，移除对 `category` 的依赖
- [x] 6.3 进度区展示按任务类型的进度（classify / rename）
- [x] 6.4 增加"单文件按类型重排"与"全量重扫"入口
- [x] 6.5 Options 标签管理改为 AI 标签治理：重命名 / 合并 / 删除 / 置顶
- [x] 6.6 移除或迁移 `userDefinedTags` 的种子词表语义

## 7. 测试与验证

- [x] 7.1 为 `tasks` / `tags` / `tag_aliases` 事务与迁移补 Vitest 用例
- [x] 7.2 覆盖 typed 任务的幂等入队、claim 原子性、失败退避
- [x] 7.3 覆盖标签归并、别名缓存、`system:*` 保留
- [x] 7.4 手动验证：SW 被回收后恢复、浏览器重启后续跑、VFS 重连后续跑
- [x] 7.5 手动验证：单文件 refresh 与全量 refresh
- [x] 7.6 更新 `ARCHITECTURE.md` 与相关 spec 文档
