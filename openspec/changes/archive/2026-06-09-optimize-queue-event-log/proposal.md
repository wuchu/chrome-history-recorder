## Why

当前的 queue 持久化方案使用完整 JSON 文件重写，每次任务状态变化都会重写整个文件。对于几百个文件的处理场景，这种方式存在潜在的性能瓶颈和可靠性问题：

1. **性能问题**：每次操作都完整重写文件，I/O 开销大
2. **可靠性问题**：并发写入可能导致数据丢失，崩溃时 processing 状态可能不完整
3. **断点续传简单**：崩溃恢复时只是将 processing 移回 pending，无法精确恢复状态

## What Changes

- 新增 `eventLog.ts` 模块，实现 append-only 事务日志
- 改用事件驱动模式：`ENQUEUE` / `START` / `COMPLETE` / `FAIL` / `RETRY` / `COMPACT`
- 每次状态变更追加日志，定期 compact 压缩
- 崩溃恢复时重放事件日志，精确重建状态
- 处理僵尸任务（processing 中的任务）时检查残留文件
- 废弃 `.ai-classify-queue-tasks.json` 和 `.ai-classify-index.json`，改用 `.ai-classify-events.log`

## Capabilities

### New Capabilities

- `event-log`: 事件日志管理，包括追加事件、状态恢复、日志压缩

### Modified Capabilities

- `queue-management`: 队列状态管理从 JSON 文件改为事件日志驱动
- `hash-index`: hashIndex.ts 的 load/save 函数废弃，状态由 eventLog 管理

## Impact

- **新增文件**：`src/eventLog.ts`
- **修改文件**：`src/index.ts`（主要改动）、`src/hashIndex.ts`（删除 load/save）
- **废弃文件**：`src/queue.ts`（改用内存数组管理）
- **数据文件**：废弃 `.ai-classify-queue-tasks.json`、`.ai-classify-index.json`，新增 `.ai-classify-events.log`