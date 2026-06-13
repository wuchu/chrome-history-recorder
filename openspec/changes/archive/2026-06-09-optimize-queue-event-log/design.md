## Context

当前的 queue 持久化方案使用 `fs.writeJson()` 完整重写 JSON 文件：

- `.ai-classify-queue-tasks.json` - 存储整个 Queue 对象（pending, processing, failed）
- `.ai-classify-index.json` - 存储整个 HashIndex 对象

每次任务状态变化（enqueue, complete, fail）都会调用 `saveState()`，触发两次完整文件重写。对于几百个文件的处理场景，虽然当前规模下性能问题不明显，但这是预防性的架构优化，主要解决：

1. **可靠性**：并发写入无保护，崩溃时 processing 状态可能丢失
2. **性能**：每次操作完整重写，I/O 开销大
3. **断点续传**：崩溃恢复简单，无法精确恢复状态

**约束**：
- 规模：几百个文件
- 使用场景：watch 模式 + batch 模式
- 优先级：可靠性 > 性能 > 恢复能力
- 严格不重复：崩溃后需知道处理到哪一步

## Goals / Non-Goals

**Goals:**
- 实现 append-only 事务日志，每次状态变更追加事件
- 崩溃恢复时重放日志，精确重建状态
- 处理僵尸任务（processing 中的任务）时检查残留文件
- 定期 compact 压缩日志，减少恢复时间
- 并发写入保护，防止数据丢失

**Non-Goals:**
- 不引入 SQLite 或其他数据库依赖
- 不改变现有的处理逻辑（classify, organize）
- 不改变 CLI 命令接口

## Decisions

### Decision 1: Append-Only Event Log vs SQLite

**选择**: Append-Only Event Log

**理由**:
- 几百个文件规模下，SQLite 过度设计
- 纯文件操作，无新依赖
- JSON Lines 格式可读性好，方便调试
- 追加写入比完整重写快得多

**Alternative**: SQLite 嵌入数据库
- 优点：事务支持、查询高效
- 缺点：引入新依赖、对几百个文件过度设计

### Decision 2: 事件类型设计

**选择**: ENQUEUE, START, COMPLETE, FAIL, RETRY, COMPACT

**理由**:
- ENQUEUE: 任务加入队列
- START: 任务开始处理（写完整 task 信息，便于恢复）
- COMPLETE: 任务处理完成（含 hash, output, category）
- FAIL: 任务处理失败（含 error 信息）
- RETRY: 失败任务重新入队
- COMPACT: 日志压缩（含完整 snapshot）

### Decision 3: 内存状态管理

**选择**: 保持数组（pending, processing, failed 为 Task[]）

**理由**:
- 可以保证优先级排序
- 几百个文件规模下，数组遍历 < 1ms
- 改动最小

**Alternative**: Map 存储（key = path）
- 优点：查找/删除 O(1)
- 缺点：失去顺序，改动更大

### Decision 4: Compact 触发时机

**选择**: 多重触发
- 阈值触发：日志行数 > 500 或 文件大小 > 100KB
- 正常退出：stop() 时执行 compact
- 启动时：如果 needsCompact 为 true，立即 compact

**理由**:
- 下次启动恢复更快（只需读一个 COMPACT 事件）
- 日志文件保持干净
- 减少磁盘占用

### Decision 5: 僵尸任务处理

**选择**: 检查 index + 清理残留文件

**处理流程**:
1. 检查 index[task.hash] 是否存在 → 存在则任务已完成
2. 不存在则检查 output 目录是否有残留文件 → 有则删除
3. 移回 pending 重新处理

**理由**:
- 严格不重复要求：需要精确知道崩溃时的状态
- 可能中途崩溃：文件已复制但 index 未更新

### Decision 6: hashIndex.ts 的关系

**选择**: 保留独立，废弃 load/save

- 保留：computeFileHash, hasBeenProcessed, addProcessedRecord
- 废弃：loadIndex, saveIndex, clearIndex

**理由**:
- 改动更清晰，减少耦合
- hashIndex 的计算函数仍然有用
- 状态管理由 eventLog 负责

## Risks / Trade-offs

### Risk 1: 日志文件损坏

**风险**: 部分日志行损坏无法解析

**缓解**:
- 逐行解析，跳过损坏的行
- 记录警告日志
- 容错恢复，返回空状态

### Risk 2: compact 过程中崩溃

**风险**: compact 写入 COMPACT 事件时崩溃

**缓解**:
- COMPACT 事件写入完成后才 truncate
- 恢复时取最后一个 COMPACT 事件

### Risk 3: 并发写入冲突

**风险**: 多个任务同时完成，并发写入日志

**缓解**:
- 使用 Promise 队列实现 writeLock
- 所有写入顺序执行，不会交错