## Why

当前 `pnpm dev` 会自动打开浏览器，但每次启动都是全新的 Chrome profile：

1. **需要重新登录**：每次启动开发服务器都要重新登录 Google 账号，调试体验差
2. **浪费时间**：频繁登录账号打断开发流程
3. **无法复用状态**：无法保留 cookies、本地存储等浏览器状态

目前 WXT 配置没有设置持久化的 Chrome profile，使用的是临时 profile。

## What Changes

- 配置 WXT 使用**项目本地的 Chrome profile 目录**（`.chrome-dev-profile/`）
- 启用 `keepProfileChanges: true` 来持久化 profile 变更
- 更新 `.gitignore` 忽略本地 profile 目录
- 首次使用时手动登录 Google 账号，之后启动会自动保持登录状态

## Capabilities

### New Capabilities
- `persist-chrome-profile`: 在开发模式下持久化 Chrome profile，保留登录状态和浏览器配置

### Modified Capabilities
- `dev-mode`: 改进开发体验，无需每次重新登录

## Impact

- 修改 `packages/extension/wxt.config.ts` 添加 profile 配置
- 更新 `.gitignore` 忽略 `.chrome-dev-profile/` 目录
- 不影响现有功能和生产构建
- 向后兼容：如果 profile 目录不存在，Chrome 会自动创建
