## Why

DevTools Panel 无法正常加载历史图片，导致用户无法查看已捕获的媒体文件。问题的根源有三：

1. **消息类型不匹配**：`useHistoricalImages.ts` 发送 `'list-files'` 消息，但 `background/index.ts` 只处理 `'listFiles'`，导致消息无法被正确处理
2. **WebSocket 连接状态不透明**：当 VFS Service 未启动或连接失败时，用户界面显示 "ws未连接"，但缺少明确的错误提示和重试机制
3. **Ollama 服务状态不透明**：当 Ollama 未运行时，界面显示 "ollama服务未启动"，但缺少健康检查和用户引导

这些问题直接影响了核心功能（媒体文件浏览）的可用性，需要立即修复。

## What Changes

- 修复 `useHistoricalImages.ts` 中的消息类型，从 `'list-files'` 改为 `'listFiles'`
- 统一消息参数格式，将 `{ limit, offset, category }` 包装为 `{ query: { limit, offset, category } }`
- 统一响应处理逻辑，正确处理 `{ success, data }` 格式的响应
- 添加 WebSocket 连接状态的实时检测和用户友好的错误提示
- 添加 Ollama 服务健康检查和连接引导
- 改进 Background Service Worker 的初始化流程，确保服务状态正确上报

## Capabilities

### New Capabilities

- `service-health-monitoring`: WebSocket 和 Ollama 服务健康状态实时监控，包括连接检测、状态上报、用户提示和重试机制
- `message-protocol-unification`: 统一 Chrome Extension 消息协议，定义标准化的消息类型、参数格式和响应结构

### Modified Capabilities

- `devtools-media-grid`: 修改历史图片加载逻辑，修复消息类型不匹配导致的加载失败问题
- `websocket-client`: 增强连接状态检测和上报机制，添加连接失败时的用户提示

## Impact

**代码变更**：
- `packages/extension/src/entrypoints/devtools-panel/hooks/useHistoricalImages.ts` - 修复消息类型和参数格式
- `packages/extension/src/entrypoints/background/index.ts` - 添加服务状态检测和上报逻辑
- `packages/extension/src/background/vfs-ws-client.ts` - 增强连接状态检测和回调机制
- `packages/extension/src/background/classify/ollama-client.ts` - 改进健康检查和状态上报

**API 影响**：
- Chrome Extension 消息协议：统一 `type` 字段使用 camelCase，统一参数使用 `query` 包装，统一响应使用 `{ success, data }` 格式

**用户体验改进**：
- DevTools Panel 显示清晰的 WebSocket 和 Ollama 连接状态
- 当服务未连接时，提供明确的错误信息和重试选项
- 媒体文件列表可以正常加载和显示