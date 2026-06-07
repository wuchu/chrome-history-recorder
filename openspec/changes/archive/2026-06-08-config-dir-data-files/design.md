## Context

当前：`output/index.json`, `output/queue.json`

## Goals

- 数据文件与配置文件同目录
- 使用 `.ai-classify-xxx.json` 前缀
- 支持旧文件迁移

## Decisions

### 文件路径

| 文件 | 新路径 |
|------|--------|
| 索引 | `<configDir>/.ai-classify-index.json` |
| 队列 | `<configDir>/.ai-classify-queue-tasks.json` |

### 配置目录获取

```typescript
const configDir = path.dirname(path.resolve(configFilePath));
```