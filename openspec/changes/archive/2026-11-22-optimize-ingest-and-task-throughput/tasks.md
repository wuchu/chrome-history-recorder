## 1. 流式入库（图片统一走 HTTP）

- [x] 1.1 在 Extension Background 增加 `uploadMedia(bytes, mimeType, sourceUrl, capturedAt)`，使用 `POST /upload` 与 `X-Source-Url`/`X-Captured-At` 头，返回现有 `SaveFileResult` 形状
- [x] 1.2 将 `FileManager.handleCaptureMedia` 改为调用 `uploadMedia`，删除 `Array.from(new Uint8Array(...))` 与 WS `saveFile` 调用
- [x] 1.3 将一键抓取的 `saveOneShotCandidate` 改为调用 `uploadMedia`，保持 duplicate/restored/size 结果与错误码映射
- [x] 1.4 保留 WS `saveFile` RPC 兼容路径，但在 Extension 中标记为未使用，避免其他调用点回归
- [x] 1.5 补充测试：成功、重复、恢复、413 超限、415 MIME、连接失败映射到 `vfs-disconnected`

## 2. HTTP 文件下载流式化与 Range

- [x] 2.1 `GET /files/:hash` 改用 `api.getBlobPath()` + `fs.createReadStream`，不再调用 `api.getFile` 读取整文件
- [x] 2.2 实现单段 `Range`：`200`/`206`/`416`、`Content-Range`、`Accept-Ranges: bytes`、正确的 `Content-Length`
- [x] 2.3 增加 `ETag`（内容 hash）、`Last-Modified` 与 `If-None-Match` → `304`
- [x] 2.4 支持 `HEAD`，返回与 `GET` 相同响应头且不发送 body
- [x] 2.5 默认 `Content-Disposition: inline`；`?download=1` 时沿用现有文件名清理与 RFC 5987 规则返回 `attachment`
- [x] 2.6 处理客户端提前断开：销毁读取流，不记录为服务器错误
- [x] 2.7 更新 Media Library 的下载动作 URL 追加 `?download=1`，视频/图片预览保持默认 URL
- [x] 2.8 补充测试：完整下载、首段/中间段/尾段、非法与多段 Range、304、HEAD、download disposition

## 3. 标签用量增量维护

- [x] 3.1 在 `sqlite.ts` 增加标签用量差异辅助函数：按旧/新用户标签集合更新 `usage_count`，并处理 active 状态与下限 0
- [x] 3.2 `applyClassification` 改为使用差异更新，删除事务内的 `recomputeTagUsage()` 调用
- [x] 3.3 `softDeleteFile`、`restoreFile`、`restoreAllFiles`、`hardDeleteFiles` 改为按文件增量更新；已删除文件再次永久删除时不重复扣减
- [x] 3.4 保留 `recomputeTagUsage()` 作为词表重命名/合并/删除及修复入口，并在测试中验证与增量结果一致
- [x] 3.5 增加 `CREATE INDEX IF NOT EXISTS idx_tags_name_nocase ON tags(name COLLATE NOCASE)`，确认 `getTagByName` 走索引
- [x] 3.6 重写 `getTagCounts`：系统计数用单条聚合查询，用户标签计数读取 `tags.usage_count`，保留 `uncategorized`
- [x] 3.7 补充测试：分类新增/移除/保留标签、软删除、恢复、永久删除、用户标签增删，以及增量结果与全量重算一致

## 4. 状态事件合并

- [x] 4.1 增加合并辅助（250ms 窗口，leading + trailing；dirty 标记 + 单次计算），可复用于 scheduler 与 archive
- [x] 4.2 Scheduler 增加 `scheduleQueueSnapshot()`：flush 时只计算一次 `getQueueStatus()` 并携带 scheduler 状态
- [x] 4.3 Scheduler 增加 `scheduleTagsSnapshot()`：flush 时只计算一次 `listTags()` + `getTagCounts()`
- [x] 4.4 移除 `beginProcessing`/`endProcessing` 的 `broadcastSchedulerStatus()`；显式 start/pause/concurrency 变更仍立即发送
- [x] 4.5 `broadcastQueueUpdated()` 改为 schedule 版本；任务生命周期事件保持即时
- [x] 4.6 Media Archive 的每任务 `emitQueueUpdated()`/`emitStatus()` 改为合并版本，drain 结束时 flush
- [x] 4.7 保留 `classify:scheduler` 作为兼容事件，与 `task:scheduler` 复用同一份快照、各发送一次，不重复计算
- [x] 4.8 使用 fake timers 补充测试：窗口内多次变更只发一次、payload 为最新值、生命周期事件不被延迟、空闲后 flush 终态

## 5. UI 消费合并后的快照

- [x] 5.1 Media Library 收到 `tags:updated` 时直接用 `{ tags, counts }` 更新词表与计数，删除 300ms 后重新请求的逻辑
- [x] 5.2 初始化与 VFS 重连仍执行一次 `getTagCounts()` + `listTags()` 冷启动加载
- [x] 5.3 `TrashPage` 改为 `collectEvents: false`，通过 `onEvent` 只处理需要的事件
- [x] 5.4 将 `useBackgroundMessaging`、`FileManager`、`VFSWebSocketClient` 的热路径 payload 日志置于 debug 开关之后
- [x] 5.5 更新/补充 Media Library 测试：事件 payload 更新标签计数、突发事件只更新一次、不再发起额外 RPC

## 6. 验证与文档

- [x] 6.1 运行 `pnpm lint`、`pnpm format:check`、`pnpm test`，修复回归
- [x] 6.2 手动验证：CDP 图片捕获、一键抓取 HTTP/data/blob、视频 Range seek、`?download=1` 下载、批量分类时标签计数正确
- [x] 6.3 更新 `ARCHITECTURE.md`：图片统一走 HTTP 上传、标签增量维护、状态事件合并、文件下载 Range
- [x] 6.4 检查 `README.md` 中关于捕获/下载/事件行为的描述是否需要同步
