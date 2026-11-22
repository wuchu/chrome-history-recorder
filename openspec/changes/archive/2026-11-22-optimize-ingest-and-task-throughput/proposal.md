## Why

批量导入与 AI 处理时，吞吐被三处非业务开销拖住：图片仍以 `number[]` JSON 走 WebSocket 入库（体积约 2×，50MB 图片可触及 `ws` 默认 100MB 上限）；每完成一个分类任务就会全量重算标签用量并多次广播队列快照；HTTP 文件下载把整个视频读入内存且不支持 Range。随着媒体库变大，这些开销线性增长，批量处理时叠加成近似二次方。

## What Changes

- **图片入库统一走流式 HTTP 上传**：Extension 的 CDP 捕获与一键抓取不再把图片字节转成 `number[]` 通过 WebSocket `saveFile` 发送，而是和视频一样调用 `POST /upload`；由 app 流式计算 hash、落临时文件并原子入库。WebSocket `saveFile` RPC 保留以兼容现有调用与测试，但 Extension 不再使用。
- **标签用量增量维护**：分类写入文件标签时，只对“旧用户标签 → 新用户标签”的差异更新 `tags.usage_count`，不再在每次分类事务里扫描全部文件并重写全部标签行；软删除、恢复、永久删除也改为按文件增量更新。保留一个显式的全量重算入口供迁移/修复使用。
- **标签计数与事件负载复用**：`getTagCounts` 的用户标签计数直接读取词表的 `usage_count`，系统标签计数用单条聚合查询；`tags:updated` 事件的 `{ tags, counts }` 成为 UI 的权威快照，Media Library 不再收到事件后重新发起 `getTagCounts` + `listTags` 请求。
- **高频状态事件合并**：app 事件总线对 `queue:updated`、`*:scheduler`、`media-archive:status`、`tags:updated` 做 250ms 级别的 leading+trailing 合并，只发送最新快照；任务生命周期事件（`task:started/completed/retrying/failed/skipped` 与文件事件）保持即时。Scheduler 不再在每次任务开始/结束时单独发 scheduler 状态事件，合并进 `queue:updated`。
- **HTTP 文件端点流式化并支持 Range**：`GET /files/:hash` 改用 `fs.createReadStream`，支持 `Range`/`206`、`Accept-Ranges`、`ETag`/`Last-Modified`；默认使用 `inline` 以便 `<video>` 预览和 seek，下载通过 `?download=1` 继续返回带文件名的 `attachment`。**BREAKING**：默认 `Content-Disposition` 从 `attachment` 改为 `inline`，依赖默认下载行为的客户端需要改用 `?download=1`。
- **索引使用修正**：为 `tags(name COLLATE NOCASE)` 增加索引，使 `getTagByName` 的 NOCASE 查找重新走索引，而不是每次全表扫描；保留现有大小写不敏感语义，不做数据迁移。

不在本次范围：缩略图并发去重、`syncBlobsToIndex` 批量化、`listFiles` 双扫描优化、WebSocket 重连策略。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `extension-file-manager`: CDP 捕获与一键抓取的入库路径统一为 `POST /upload` 流式上传，不再通过 WebSocket 发送图片字节数组。
- `one-shot-media-capture`: 一键抓取保存改为流式上传，用户可见行为与结果不变。
- `vfs-http-api`: 文件下载端点改为流式并支持 Range/条件缓存；上传端点显式覆盖图片；默认 inline、`?download=1` 下载。
- `vfs-service`: 标签用量按文件差异增量维护；`getTagCounts` 不再依赖每次分类的全量文件扫描。
- `tag-management`: 分类写入与回收站操作对 `usage_count` 的维护语义从“全量重算”改为“增量且最终一致”。
- `app-event-bus`: 高频状态事件合并发送，同时保证任务生命周期与文件事件即时、按序。
- `task-queue`: 队列状态事件可以合并为最新快照；任务级事件仍然逐个发送。
- `websocket-events`: 定义 `tags:updated` 快照事件与状态事件的合并语义。
- `options-media-library`: 标签计数与词表直接使用 `tags:updated` 负载，不再在事件后重复拉取。

## Impact

- **Extension**：`background/file-manager.ts`、`background/one-shot-capture.ts`、`background/debugger-capture.ts`、`background/vfs-ws-client.ts`、`entrypoints/options/components/MediaLibrary.tsx`、`options/components/TrashPage.tsx`、`media-browser/hooks/useBackgroundMessaging.ts`。
- **VFS**：`http-server.ts`（流式下载/Range/inline）、`api.ts`（上传与计数入口）、`sqlite.ts`（增量 usage、`getTagCounts`、`getTagByName` 索引、软删/恢复/清除的增量维护）、`websocket-server.ts`（事件负载与合并接入）。
- **App**：`event-bus.ts`（合并器）、`scheduler.ts`（减少重复状态事件、标签快照节流）、`media-archive.ts`（依赖合并后的状态事件）。
- **协议**：WebSocket 事件负载不变，但部分高频事件发送频率降低；HTTP `/files/:hash` 默认 disposition 变化。
- **数据**：无新表；新增 `tags(name COLLATE NOCASE)` 索引；`usage_count` 维护路径改变，需要一致性测试覆盖分类、软删除、恢复、永久删除与用户标签增删。
- **测试**：新增/更新 HTTP Range、流式上传、增量 usage、事件合并节流与 UI 负载复用测试；现有 Vitest 套件需全绿。
