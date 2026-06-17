## 1. VFS Service WebSocket Server

- [x] 1.1 创建 `packages/vfs-service/src/websocket-server.ts`
- [x] 1.2 实现 WebSocket Server 类，监听端口 8765
- [x] 1.3 复用现有 Dispatcher 路由逻辑处理 API 请求
- [x] 1.4 实现事件广播机制（broadcast 方法）
- [x] 1.5 实现连接管理（客户端跟踪、断开处理）
- [x] 1.6 实现心跳机制（30 秒间隔）
- [x] 1.7 添加错误处理和日志记录

## 2. VFS Service HTTP Server

- [x] 2.1 创建 `packages/vfs-service/src/http-server.ts`
- [x] 2.2 实现 HTTP Server 类，监听端口 8766
- [x] 2.3 实现 CORS 配置（Access-Control-Allow-Origin）
- [x] 2.4 实现 `GET /files/:hash` 文件下载端点
- [x] 2.5 实现 `GET /files/:hash/thumbnail` 缩略图端点
- [x] 2.6 实现 `GET /files/:hash/metadata` 元数据端点
- [x] 2.7 实现 `GET /stats` 统计端点
- [x] 2.8 实现 `GET /health` 健康检查端点
- [x] 2.9 实现 `GET /` 服务信息端点
- [x] 2.10 添加缓存控制头（Cache-Control）

## 3. VFS Service 入口重构

- [x] 3.1 修改 `packages/vfs-service/src/index.ts`
- [x] 3.2 同时启动 WebSocket Server 和 HTTP Server
- [x] 3.3 保持 API 层初始化不变（VFSAPI, Dispatcher）
- [x] 3.4 添加服务启动日志
- [x] 3.5 添加优雅关闭处理

## 4. VFS Service 依赖更新

- [x] 4.1 添加 `ws` WebSocket 库到 dependencies
- [x] 4.2 更新 `package.json` scripts（start, dev）
- [x] 4.3 运行 `pnpm install` 安装新依赖

## 5. Extension WebSocket Client

- [x] 5.1 创建 `packages/extension/src/background/vfs-ws-client.ts`
- [x] 5.2 实现 WebSocket Client 类，连接 ws://localhost:8765
- [x] 5.3 实现自动重连机制（5 秒间隔）
- [x] 5.4 实现 API 方法（保持与现有 VFSClient 相同签名）
- [x] 5.5 实现连接状态管理（connected, connecting, disconnected）
- [x] 5.6 实现事件处理（onConnect, onDisconnect, onEvent）
- [x] 5.7 实现请求超时处理（30 秒）

## 6. Extension Background Worker 改动

- [x] 6.1 修改 `packages/extension/src/entrypoints/background/index.ts`
- [x] 6.2 替换 initVFSClient 为 initVFSWebSocketClient
- [x] 6.3 添加连接等待逻辑（使用 onConnect 回调）
- [x] 6.4 修改 `packages/extension/src/background/file-manager.ts`
- [x] 6.5 替换 getVFSClient 为 getVFSWebSocketClient
- [x] 6.6 移除 thumbnail 缓存管理代码（约 50 行）
- [x] 6.7 修改 `packages/extension/src/background/classify/scheduler.ts`
- [x] 6.8 替换 vfsClient 为 vfsWebSocketClient

## 7. Extension DevTools Panel 改动

- [x] 7.1 修改 DevTools Panel 组件使用 HTTP URL 获取缩略图
- [x] 7.2 替换 `getThumbnailUrl()` 为直接 HTTP URL
- [x] 7.3 添加 VFS 连接状态显示
- [x] 7.4 添加服务未启动时的提示

## 8. Extension 配置改动

- [x] 8.1 修改 `packages/extension/wxt.config.ts`
- [x] 8.2 移除 `nativeMessaging` 权限
- [x] 8.3 添加 `http://localhost:8766/*` host_permission
- [x] 8.4 更新 manifest permissions

## 9. 删除 Native Messaging 代码

- [x] 9.1 删除 `packages/vfs-service/src/native-host-setup.ts`
- [x] 9.2 删除 `packages/vfs-service/src/native-messaging.ts`
- [x] 9.3 删除 `packages/extension/src/background/vfs-client.ts`
- [x] 9.4 清理 index.ts 中 Native Messaging 相关代码

## 10. 测试和验证

- [x] 10.1 测试 WebSocket Server API 调用
- [x] 10.2 测试 HTTP Server 文件下载
- [x] 10.3 测试 HTTP Server 缩略图获取
- [x] 10.4 测试 Extension WebSocket 连接和重连
- [x] 10.5 测试文件捕获完整流程
- [x] 10.6 测试 AI 分类完整流程
- [x] 10.7 测试 DevTools Panel 展示
- [x] 10.8 验证服务未启动时的错误处理

## 11. 文档更新

- [x] 11.1 更新 README 启动说明
- [x] 11.2 更新根 package.json scripts
- [x] 11.3 添加 VFS Service 端口配置说明