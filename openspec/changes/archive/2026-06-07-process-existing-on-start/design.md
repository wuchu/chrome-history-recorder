## Context

当前 `AIClassify` 的队列持久化机制：

**队列恢复机制（已完善）：**
- `loadQueue()` 从 `output/queue.json` 加载队列
- `processing` 中的任务恢复为 `pending`，确保中断的任务重新处理
- `saveQueue()` 每次状态变化时保存队列

当前 `AIClassify.start()` 的实现：

```typescript
async start(): Promise<void> {
  // Process existing queue first (来自上次中断的任务)
  await this.processQueue();

  // Start watching for new files
  this.watcher = new Watcher(this.config, async (task: Task) => {
    await this.addTask(task);
  });
  await this.watcher.start();

  console.log('AI Classify started');
}
```

**问题：** 只处理已有队列（中断恢复），不扫描 input 目录的现有文件。

**恢复流程分析：**
| 场景 | 当前行为 | 是否正确 |
|------|----------|----------|
| 程序中断退出 | `processing` → `pending`，重新处理 | ✓ 已完善 |
| 正常重启有队列 | 加载队列，处理 `pending` 任务 | ✓ 已完善 |
| 新 input 文件 | 不扫描，需要手动 `reprocess` | ✗ 缺失 |

## Goals / Non-Goals

**Goals:**
- `start` 命令启动时自动扫描 input 目录并处理现有文件
- 保持 deduplication 功能（已处理的文件不重复处理）
- watch 继续监控后续变更

**Non-Goals:**
- 不修改 `reprocess` 命令行为（它仍用于清空索引重新处理）
- 不修改文件扫描逻辑本身

## Decisions

### 1. 扫描时机

**方案**：在 `start()` 中调用 `scanAndEnqueue()` 后再启动 watch

```typescript
async start(): Promise<void> {
  // Scan and enqueue existing files
  await this.scanAndEnqueue();
  
  // Process the queue
  await this.processQueue();

  // Start watching for new files
  this.watcher = new Watcher(this.config, async (task: Task) => {
    await this.addTask(task);
  });
  await this.watcher.start();

  console.log('AI Classify started');
}
```

**理由**：
- 保持与 `reprocess` 的区别：`reprocess` 清空索引后扫描，`start` 不清空索引
- 简单直接，复用现有 `scanAndEnqueue()` 方法

### 2. 与 reprocess 的区别

| 命令 | 行为 |
|------|------|
| `start` | 扫描现有文件，跳过已处理（根据 hash index），启动 watch |
| `reprocess` | 清空索引和队列，重新扫描所有文件，不启动 watch |

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 大量文件时启动较慢 | 显示扫描进度，用户可理解等待 |
| 与之前行为不同 | 文档说明新行为，用户无需额外操作 |