## Why

当前 ai-classify 的 `start` 命令只处理已有队列中的任务，不会主动扫描 input 目录下已存在的文件。用户需要手动运行 `reprocess` 命令才能处理现有文件，这不够直观。

期望行为：启动时自动扫描并处理 input 目录下的所有现有文件，watch 仅用于监控后续变更。

## What Changes

- 修改 `start()` 方法行为：启动时先扫描 input 目录已有文件并加入队列处理
- watch 功能保持不变：监控文件变更，将新文件或修改的文件加入队列
- 保持 `reprocess` 命令作为清空索引并重新处理的专用命令

## Capabilities

### New Capabilities
- 无（不引入新功能，仅修改现有行为）

### Modified Capabilities
- `task-queue`: 修改任务队列的启动处理逻辑，start 时自动扫描并入队现有文件

## Impact

- 修改 `packages/ai-classify/src/index.ts` - start() 方法
- 可能需要调整 `scanAndEnqueue()` 的调用时机
- 用户无需先运行 reprocess，直接 start 即可处理现有文件