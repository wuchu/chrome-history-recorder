## Why

当前 index.json 和 queue.json 存放在 output 目录，配置分散。

期望：存放在配置文件同目录，使用 `.ai-classify-xxx.json` 命名。

## What Changes

- 文件路径：`output/` → 配置文件同目录
- 文件命名：
  - `index.json` → `.ai-classify-index.json`
  - `queue.json` → `.ai-classify-queue-tasks.json`

## Capabilities

### Modified Capabilities
- `hash-index`: 索引文件路径和命名
- `task-queue`: 队列文件路径和命名

## Impact

- 修改 hashIndex.ts, queue.ts, cli.ts, index.ts