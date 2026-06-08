## Why

npm-run-all 输出格式简陋，多个进程的日志混在一起难以区分来源。concurrently 提带前缀的彩色输出，更清晰地区分不同进程的日志。

## What Changes

- 移除 `npm-run-all` 依赖
- 添加 `concurrently` 依赖
- 修改 `dev` 和 `dev:no-browser` 脚本使用 concurrently

## Capabilities

### New Capabilities

无新增能力。

### Modified Capabilities

无需求变更。这是实现层面的工具替换，功能行为保持不变。

## Impact

| 文件 | 变更 |
|------|------|
| `package.json` | 替换依赖 + 修改 dev scripts |
| `pnpm-lock.yaml` | 自动更新 |