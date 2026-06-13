## Context

当前 VFS Service 使用 Chrome Native Messaging 与 Extension 通信：

```
Extension (Background Worker)
    │
    │ chrome.runtime.connectNative('com.xxx.vfs')
    │
    ▼
VFS Service (Native Host)
    │ stdin/stdout
    │ Native Messaging Protocol
    │
    ▼
SQLite + Blob Storage
```

**问题**：
- Native Messaging Host 需要注册到 Chrome 的 NativeMessagingHosts 目录
- Chrome 只在启动时加载 Native Host manifest
- 连接状态不透明，`connectNative()` 返回后无法确认实际连接成功
- VFS Service 无法独立启动测试，必须通过 Chrome 启动
- 二进制数据需要 base64 编码，增加 33% 数据量

**约束**：
- VFS Service 已有完善的 API 层（`VFSAPI`, `Dispatcher`），应保持不变
- Extension 的 `FileManager` 封装了 VFS Client，应尽量保持接口一致
- DevTools Panel 已有 WebSocket 客户端用于 Proxy 服务（端口 3777），可复用模式

## Goals / Non-Goals

**Goals:**
- 将 VFS Service 从 Native Messaging 改为 WebSocket + HTTP 双通道
- 保持现有 API 层不变，仅替换传输层
- 简化 Extension 权限，移除 `nativeMessaging`
- 支持独立启动和调试 VFS Service
- DevTools Panel 可直接通过 HTTP 获取文件和缩略图

**Non-Goals:**
- 不改变 VFS Service 的数据存储层（SQLite, Blob Storage）
- 不改变 API 方法签名（`saveFile`, `getFile` 等）
- 不涉及 Proxy 服务（端口 3777）的改动
- 不实现认证机制（本地服务，仅允许 localhost 连接）

## Decisions

### D1: WebSocket + HTTP 双通道 vs 纯 WebSocket

**决策**: 使用 WebSocket + HTTP 双通道

**理由**:
- WebSocket 适合实时事件推送和小数据 API 调用
- HTTP 适合文件下载（原生二进制，无需编码）和缩略图（浏览器缓存）
- DevTools Panel 可直接用 `<img src="http://localhost:8766/files/xxx/thumbnail">`

**替代方案**: 纯 WebSocket + 二进制帧
- 需要实现 WebSocket 二进制协议
- 无法利用浏览器原生缓存
- 大文件会阻塞消息通道

### D2: 端口选择

**决策**:
- WebSocket Server: `ws://localhost:8765`
- HTTP Server: `http://localhost:8766`

**理由**:
- 避免与 Proxy 服务（3777）冲突
- 相邻端口便于记忆和配置
- 可通过环境变量或配置文件自定义

### D3: 复用 Dispatcher 路由

**决策**: WebSocket Server 复用现有 `Dispatcher` 路由逻辑

**理由**:
- 现有 `Dispatcher` 已实现所有 API 方法路由
- WebSocket 消息格式与 Native Messaging 相同（`{id, method, params}`）
- 仅需替换传输层，无需重写业务逻辑

### D4: Extension 连接策略

**决策**: Background Worker 使用 WebSocket Client 连接 VFS，DevTools Panel 直接 HTTP 访问

**理由**:
- Background Worker 需要调用 API（`saveFile`, `enqueueClassification`）
- DevTools Panel 主要用于展示（文件列表、缩略图），HTTP 更简单
- 减少消息转发层级，提高响应速度

## Risks / Trade-offs

### R1: 服务未启动时的用户体验

**风险**: 用户加载 Extension 时 VFS Service 未启动，WebSocket 连接失败

**缓解**:
- WebSocket Client 实现优雅重连（每 5 秒尝试）
- DevTools Panel 显示连接状态和提示
- 提供 "启动 VFS Service" 的指引文档

### R2: CORS 配置

**风险**: Extension 访问 HTTP Server 需要 CORS 配置

**缓解**:
- HTTP Server 设置 `Access-Control-Allow-Origin: chrome-extension://*`
- 或设置 `Access-Control-Allow-Origin: *`（仅本地服务，风险可控）

### R3: 端口冲突

**风险**: 端口 8765/8766 可能被其他服务占用

**缓解**:
- 服务启动时检测端口可用性
- 提供配置文件自定义端口
- 启动失败时显示清晰的错误信息

### R4: 热重载期间的数据一致性

**风险**: VFS Service 热重载时 WebSocket 连接断开，可能导致正在处理的请求丢失

**缓解**:
- WebSocket Client 实现请求超时和重试
- VFS Service 重启后自动恢复队列状态（SQLite 持久化）

## Migration Plan

### Phase 1: 实现 WebSocket + HTTP Server (不删除 Native Messaging)

1. VFS Service 新增 WebSocket Server 和 HTTP Server
2. Extension 新增 WebSocket Client
3. 同时保留 Native Messaging 作为备用
4. 测试 WebSocket 方案稳定性

### Phase 2: 切换到 WebSocket

1. Extension 默认使用 WebSocket 连接
2. 验证所有功能正常
3. 移除 Native Messaging 相关代码

### Phase 3: 清理

1. 删除 `native-host-setup.ts`, `native-messaging.ts`
2. 删除 Extension 的 `nativeMessaging` 权限
3. 更新文档和启动脚本

## Open Questions

1. **服务发现**: Extension 如何知道 VFS Service 地址？
   - 当前方案：固定 `localhost:8765/8766`
   - 备选方案：配置文件可自定义

2. **多实例支持**: 是否需要支持多个 VFS Service 实例？
   - 当前设计：单实例，固定端口
   - 如需多实例，需要配置不同端口

3. **生产部署**: 生产环境如何部署 VFS Service？
   - 当前设计：开发模式，手动启动
   - 生产可能需要系统服务（systemd, launchd）