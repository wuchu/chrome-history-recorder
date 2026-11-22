## Context

当前吞吐瓶颈集中在三条链路：

1. **入库**：视频已经通过 `POST /upload` 流式写入，但图片仍由 Background 转成 `number[]` 后走 WebSocket `saveFile`。`Array.from`、`JSON.stringify`、`JSON.parse` 和 `Buffer.from` 让 5MB 图片产生约 10MB 负载和约 120ms 的双端 CPU；50MB 图片会接近 `ws` 默认 100MiB `maxPayload`。
2. **任务侧**：每次 `classify` 完成都会在事务内调用 `recomputeTagUsage()`（读取全部文件、解析 tags、更新全部标签行），随后 scheduler 再调用 `getTagCounts()`，Options 收到 `tags:updated` 后又重新请求 `getTagCounts()` + `listTags()`。单个任务会触发多轮全量扫描。同时调度器每个任务发出约 13 条事件，其中 3 条携带 `getQueueStatus()` 快照。
3. **读取**：`GET /files/:hash` 通过 `readFileSync` 读取整个 blob，忽略 `Range`，并固定 `Content-Disposition: attachment`；`<video>` 预览无法 seek，内存随视频大小线性增长。

本变更只处理这三条链路；缩略图并发去重、`syncBlobsToIndex` 批量化、`listFiles` 计数优化不在范围内。

## Goals / Non-Goals

**Goals:**

- 图片与视频共用同一条流式上传入库路径，Extension 不再把媒体字节转换为 JSON 数组。
- 标签 `usage_count` 在分类和回收站操作中按文件差异增量维护；`getTagCounts` 不再触发逐文件 JSON 扫描。
- 高频状态事件（队列、调度器、归档、标签快照）按时间窗合并，任务生命周期与文件事件保持即时。
- 文件下载流式化，支持单段 `Range`、条件请求和 inline/attachment 两种用途。
- 所有对外事件负载与 HTTP JSON 字段保持兼容；现有 UI 行为不回退。

**Non-Goals:**

- 不引入新的任务类型、数据库表或 WebSocket 消息格式。
- 不改变 AI 分类/重命名的提示词、并发模型或 Ollama 调用策略。
- 不优化缩略图生成、`syncBlobsToIndex`、`listFiles` 的 COUNT 查询。
- 不改变 Extension 与 app 的连接协议（仍为 WebSocket RPC + events）。

## Decisions

### 1. 媒体入库统一走 `POST /upload`

**选择**：在 Background 增加 `uploadMedia(bytes, mimeType, sourceUrl, capturedAt)`，使用 `fetch('http://localhost:8766/upload', { method: 'POST', body: bytes })`。`FileManager.handleCaptureMedia` 与一键抓取的保存链路都调用它；WebSocket `saveFile` RPC 保留，但 Extension 不再调用。

**理由**：

- `saveFileFromStream` 已经实现边接收边计算 SHA-256、临时文件、重复检测和原子 rename；图片签名校验对非视频直接返回 true，因此服务端无需改动核心逻辑。
- HTTP 原生支持流式请求和背压；字节作为二进制 body 传输，没有 2× JSON 膨胀和 `maxPayload` 上限。
- 视频上传已经验证了该路径（包括 CORS 与 Private Network Access），复用可减少协议分叉。

**替代方案**：

- WebSocket 二进制帧：需要自定义帧协议、处理分片和双端编解码，改动面大于直接复用 HTTP。
- JSON + base64：体积仍为 1.33×，且需要额外编解码，收益有限。
- 保持现状并提高 `maxPayload`：不能消除序列化和内存放大，只是把上限推高。

**实现要点**：

- 上传响应映射到现有 `SaveFileResult`（`hash`、`duplicate`、`restored`、`size`、`mimeType`）。
- 失败按现有 one-shot 错误码归类：连接失败 → `vfs-disconnected`，4xx → 对应原因，5xx → `unknown`。
- `X-Source-Url` 与 `X-Captured-At` 继续携带来源信息；app 的 `ingestHook` 仍负责 `file:captured`、AI/归档入队。
- 分块保存的 `Array.from` 调用全部删除；大图不再经过 JSON 序列化。

### 2. 文件下载流式化与 Range

**选择**：`GET /files/:hash` 改用 `api.getBlobPath()` + `fs.createReadStream`，支持单段 `Range`，并返回 `Accept-Ranges: bytes`、`Content-Range`、`ETag`（`"<hash>"`）和 `Last-Modified`。默认 `Content-Disposition: inline`；`?download=1` 时返回现有 sanitize 后的 `attachment` 文件名。

**理由**：

- 视频预览需要浏览器按需读取和 seek；`inline` + Range 是 `<video preload="metadata">` 正常工作的前提。
- 流式响应避免把最大 200MB 的视频整体读入 app 内存，也不阻塞事件循环。
- `ETag = hash` 天然稳定，配合 `If-None-Match` 可减少重复读取。

**行为约定**：

- 无 `Range`：`200`，`Content-Length` 为完整大小，流式发送。
- 单段合法 `Range`：`206`，返回 `Content-Range: bytes start-end/size` 与对应 `Content-Length`。
- 多段或非法 `Range`：`416`，返回 `Content-Range: bytes */size`；不实现 multipart/byteranges。
- `If-None-Match` 命中：`304`，无 body。
- `HEAD`：返回与 `GET` 相同的头，不发送 body。
- 客户端提前断开：销毁读取流，不记录为服务错误。
- `?download=1`：继续使用现有文件名清理与 RFC 5987 `filename*` 规则；下载动作在 Media Library 中显式带该参数。

### 3. 标签用量增量维护

**选择**：引入 `applyTagUsageDelta(oldUserTags, newUserTags, active)`，在现有事务内只更新发生变化的标签行：

- 分类：旧文件标签（去掉 `system:*`）与新规范化标签做差集；移除的标签 `usage_count - 1`，新增的 `+ 1`，未变化的标签不写。
- 软删除：若文件原本 active，则对其全部用户标签 `- 1`。
- 恢复：对恢复文件的用户标签 `+ 1`。
- 永久删除：仅当文件 active 时对其用户标签 `- 1`。
- `addFileTags` / `removeFileTags` 已按增量更新，保持不变。
- `renameTag` / `mergeTags` / `deleteTag` 仍是词表级操作，保留一次 `recomputeTagUsage()` 作为修复/重写路径。

**理由**：

- 分类是最高频写入路径；把 O(files × tags) 降为 O(tags in one file)。
- 回收站和永久删除同样是单文件操作，继续全量重算会留下同样的 O(N) 成本。
- 词表重命名/合并/删除是低频用户操作，保留全量重算更简单且能自愈潜在漂移。

**`getTagCounts`**：

- `all` / `image` / `video` / `starred` 用一条聚合查询。
- 用户标签计数直接 `SELECT name, usage_count FROM tags`，不再对 `files.tags` 做 `json_each` 分组。
- `uncategorized` 仍需一条文件级查询（没有用户标签的文件）；保留但只在 UI 初始化、重连或合并后的快照中调用。
- 响应字段保持不变：`all`、`image`、`video`、`starred`、`uncategorized` 以及用户标签名。

**`getTagByName`**：

- 增加 `CREATE INDEX IF NOT EXISTS idx_tags_name_nocase ON tags(name COLLATE NOCASE)`，保留现有大小写不敏感语义，同时恢复索引查找。
- 不修改已有唯一索引，不做名称数据迁移。

### 4. 状态事件合并

**选择**：在 app 侧做两层合并：

1. **Scheduler 的查询型快照**：新增 `scheduleQueueSnapshot()` 与 `scheduleTagsSnapshot()`。调用只设置 dirty 标记；若距上次 flush 超过 `250ms` 则立即 flush，否则安排 trailing timer。flush 时各计算一次 `getQueueStatus()` 和 `listTags() + getTagCounts()`，然后发出一条 `queue:updated` 和一条 `tags:updated`。
2. **其他状态事件**：`EventBus` 增加通用 coalescer，对 `media-archive:status` 等已计算好的事件保留最新 payload，按同一时间窗发送。

**即时事件**（不合并）：`file:captured`、`file:trashed`、`file:restored`、`file:purged`、`trash:*`、`task:started`、`task:completed`、`task:retrying`、`task:failed`、`task:skipped` 以及对应的 `classify:*` / `rename:*` 完成/失败/跳过事件。

**Scheduler 调整**：

- `beginProcessing` / `endProcessing` 不再调用 `broadcastSchedulerStatus()`；处理中数量通过合并后的 `queue:updated`（已包含 `scheduler` 字段）反映。
- `broadcastQueueUpdated()` 改为 `scheduleQueueSnapshot()`；任务开始/完成/失败时仍调用它，但实际发送频率受窗口限制。
- 显式 start/pause/concurrency 变更仍立即发送 scheduler 状态，保证按钮反馈不滞后。
- `classify:scheduler` 与 `task:scheduler` 继续保留：两者复用同一份已计算的 scheduler 快照，只各发送一次；本变更不删除兼容事件，待确认没有消费者后再单独移除。

**Media Archive 调整**：

- 每个 copy 完成后的 `emitQueueUpdated()` / `emitStatus()` 改为 schedule 版本；drain 结束时的最终 flush 保证终态可见。

**UI 调整**：

- `MediaLibrary` 直接使用 `tags:updated` 的 `{ tags, counts }` 更新 `tagVocabulary` 与 `tagCounts`，删除 300ms 后重新请求的逻辑。
- 初始化与 VFS 重连仍调用一次 `getTagCounts()` + `listTags()` 作为冷启动数据。
- `TrashPage` 改为 `collectEvents: false`，只在 `onEvent` 中处理关心的事件，避免保存 500 条完整事件。
- 热路径日志（每条事件 `console.log` 完整 data）加 debug 开关或降级为不打印 payload。

### 5. 兼容与顺序语义

- WebSocket 事件负载不变；减少的只是高频快照的发送次数。
- 合并窗口内的事件按“最新快照覆盖旧快照”处理；任务生命周期事件仍按发生顺序即时发送。
- 消费者若依赖每一次 `queue:updated` 中间态，需要改为读取快照中的最新计数；现有 UI 均按快照渲染，无需改动。

## Risks / Trade-offs

- **[增量 usage 与全量重算漂移]** → 为分类、软删除、恢复、永久删除、用户标签增删各写一致性测试；保留 `recomputeTagUsage()` 作为修复入口；测试中对比增量结果与全量重算结果。
- **[并发分类同时更新同一标签]** → 增量更新在现有 SQLite 事务内执行，`UPDATE ... + 1/-1` 由数据库串行化；同标签并发增减不会丢失（以行锁/事务为准）。
- **[事件合并让 UI 少看到中间态]** → 合并的是快照类事件，终态与任务级事件即时；`queue:updated` 始终携带最新完整计数，进度条不会回退。
- **[默认 `inline` 破坏下载客户端]** → Media Library 下载按钮显式加 `?download=1`；保留 RFC 5987 文件名逻辑；HTTP 测试覆盖两种 disposition。
- **[Range 实现边界]** → 只支持单段；非法/多段返回 416；测试覆盖 `bytes=0-`、中间段、越界段和 `If-None-Match`。
- **[图片上传统一后的错误映射]** → 保留 one-shot 的 `vfs-disconnected` / `unsupported-mime` / `too-large` 分类；HTTP 状态码映射到现有结果结构。
- **[旧扩展仍使用 `saveFile`]** → RPC 保留，协议兼容；新扩展只改调用点。

## Migration Plan

1. 先发布 app 侧改动（流式下载、增量 usage、NOCASE 索引、事件合并），旧扩展继续通过 `saveFile` 工作。
2. 发布扩展侧改动（图片改走 `/upload`），观察 one-shot 与 CDP 捕获的保存/重复/失败路径。
3. 回滚策略：扩展可回退到 `saveFile`（RPC 仍在）；app 的事件合并与流式下载可独立回退，不涉及数据迁移。
4. `usage_count` 若出现异常，可运行一次 `recomputeTagUsage()`（测试/维护入口）修复，无需 schema 回滚。

## Open Questions

- 合并窗口固定 `250ms` 是否合适？可以先用常量并在压测后调整；暂不暴露为配置。
- `tags:updated` 是否需要对不同客户端做订阅过滤？本次不做，先通过合并降低发送量。
