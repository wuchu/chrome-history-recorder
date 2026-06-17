## Why

VFS Service 当前使用 Chrome Native Messaging 与 Extension 通信，存在以下问题：

1. **连接不稳定** - Native Messaging Host 需要注册 manifest，Chrome 启动时才能识别，连接状态不透明
2. **调试困难** - Native Messaging 使用 stdin/stdout，无法独立启动和测试 VFS Service
3. **无法 Hot Reload** - VFS Service 作为 Native Host 无法支持热重载，每次改动需要重启 Chrome
4. **权限复杂** - Extension 需要 `nativeMessaging` 特殊权限，Native Host manifest 需要手动注册

WebSocket 方案可以解决这些问题，同时为 VFS Service 提供 HTTP API 用于文件传输，简化整体架构。

## What Changes

**BREAKING** - 移除 Native Messaging 通信方式

- **移除** Native Messaging Host manifest 注册逻辑（`native-host-setup.ts`）
- **移除** Native Messaging 协议实现（`native-messaging.ts`）
- **移除** Extension 的 `nativeMessaging` 权限
- **新增** VFS WebSocket Server（端口 8765）用于 API 调用和事件推送
- **新增** VFS HTTP Server（端口 8766）用于文件下载和缩略图获取
- **新增** WebSocket 客户端实现（替代现有 `VFSClient`）
- **简化** DevTools Panel 直接通过 HTTP 获取文件和缩略图，无需通过 Background Worker 转发

## Capabilities

### New Capabilities

- `vfs-websocket-server`: VFS WebSocket Server 实现，用于 API 调用和实时事件推送
- `vfs-http-api`: VFS HTTP Server 实现，用于文件下载、缩略图获取和静态资源

### Modified Capabilities

- `websocket-events`: 扩展事件类型，增加 VFS 相关事件（`vfs:connected`, `vfs:disconnected`, `file:deleted`, `queue:updated`）

## Impact

### VFS Service (`packages/vfs-service`)
- 新增 WebSocket Server 和 HTTP Server 入口
- 删除 Native Messaging 相关代码（约 230 行）
- 保持现有 API 层（`VFSAPI`, `Dispatcher`）不变，仅替换传输层
- 新增依赖：`ws` (WebSocket 库)

### Extension (`packages/extension`)
- 替换 `vfs-client.ts` → `vfs-ws-client.ts`
- 简化 `file-manager.ts`，移除 thumbnail 缓存管理（约 50 行）
- 修改 `wxt.config.ts`，移除 `nativeMessaging` 权限，添加 localhost host permission
- DevTools Panel 直接使用 HTTP URL 获取文件和缩略图

### Manifest
- 移除 Native Messaging Host 注册（`~/Library/Application Support/Google/Chrome/NativeMessagingHosts/...`）
- Extension 无需 `nativeMessaging` 权限