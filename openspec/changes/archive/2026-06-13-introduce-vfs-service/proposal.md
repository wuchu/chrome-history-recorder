## Why

当前架构存在职责划分不清的问题：Proxy Server 承担了文件存储、HTTP API、WebSocket 通信、插件系统等多重职责，而 Extension 由于浏览器沙箱限制无法直接操作本地文件，导致业务逻辑分散在 Proxy 和 Plugin 之间。这带来了部署复杂度高（需要独立运行 Node.js 服务）、IPC 延迟、以及职责边界模糊等问题。

通过引入 VFS Service 作为纯存储引擎，并将所有业务逻辑迁移到 Extension，可以实现更清晰的职责分层、更简单的部署体验（Chrome 自动管理 Native Host），以及更好的可维护性。

## What Changes

- **BREAKING**: 移除 Proxy Server（packages/proxy）
- **BREAKING**: 移除 Proxy Plugin System 和 ai-classify Plugin
- 新增 VFS Service 作为独立 Native Messaging Host
- Extension 通过 Native Messaging 与 VFS Service 通信
- 文件操作逻辑从 Proxy 迁移到 Extension Background Service Worker
- AI 分类逻辑从 ai-classify 包迁移到 Extension
- 使用 SQLite 作为文件元数据索引，物理文件以 hash 平铺存储
- 分类结果仅修改 SQLite 元信息，不移动物理文件

## Capabilities

### New Capabilities

- `vfs-service`: 虚拟文件系统服务，提供原子化文件读写、SQLite 元数据管理、Native Messaging API
- `extension-file-manager`: Extension 内置的文件管理逻辑，通过调度 VFS 实现本地媒体资源管理
- `extension-ai-classify`: Extension 内置的 AI 分类逻辑，直接调用 Ollama API，通过 VFS 更新元数据
- `native-messaging-client`: Extension 的 Native Messaging 客户端实现

### Modified Capabilities

- `local-storage-proxy`: **移除** - 被 VFS Service 替代
- `proxy-plugin-system`: **移除** - 插件架构不再需要
- `websocket-client`: **移除** - 改用 Native Messaging
- `websocket-events`: **移除** - 改用 chrome.runtime 内部消息
- `image-capture-extension`: 修改 - 添加文件保存和分类调度逻辑
- `video-capture-extension`: 修改 - 添加文件保存逻辑
- `ollama-classifier`: 修改 - 接口调整以适配 Extension 调用
- `task-queue`: 修改 - 迁移到 Extension 内部管理

## Impact

### 受影响的包

- `packages/proxy` - **移除整个包**
- `packages/ai-classify` - 核心逻辑迁移到 Extension，standalone CLI 不再保留
- `packages/extension` - 添加 Background Service Worker 逻辑、VFS 客户端

### 新增代码

- `packages/vfs-service/` - 新包，Native Messaging Host
  - SQLite 管理模块
  - Blob 存储模块
  - Native Messaging 协议处理
  - Workspace 配置管理

### API 变化

- HTTP API (`/save-image`, `/images`, etc.) → Native Messaging API
- WebSocket Events → chrome.runtime.sendMessage
- Plugin Hooks → Extension 内部函数调用

### 部署变化

- 不再需要手动启动 Proxy Server
- Chrome 自动启动 VFS Service Native Host
- 需要注册 Native Messaging Manifest（安装时一次性配置）