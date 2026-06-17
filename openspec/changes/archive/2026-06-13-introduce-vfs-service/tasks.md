## 1. VFS Service 包初始化

- [x] 1.1 创建 packages/vfs-service 目录结构
- [x] 1.2 初始化 package.json（依赖: better-sqlite3, sharp, ffmpeg-static）
- [x] 1.3 配置 TypeScript 和 ESLint
- [x] 1.4 创建 Native Messaging Manifest 模板文件（com.yourapp.vfs.json）

## 2. VFS Service SQLite 管理模块

- [x] 2.1 实现 SQLite 初始化和 schema 创建
- [x] 2.2 实现 files 表 CRUD 操作（create, read, update, delete）
- [x] 2.3 实现 classify_queue 表操作（enqueue, dequeue, status update）
- [x] 2.4 实现 metadata update 方法（分类结果写入）
- [x] 2.5 实现 listFiles 查询方法（分页、过滤、排序）
- [x] 2.6 实现 getStats 统计方法

## 3. VFS Service Blob 存储模块

- [x] 3.1 实现 hash 计算函数（SHA-256 truncated to 16 chars）
- [x] 3.2 实现 blob 文件保存（workspace/blobs/{hash}.{ext}）
- [x] 3.3 实现 blob 文件读取（返回 ArrayBuffer）
- [x] 3.4 实现 blob 文件删除（软删除和硬删除）
- [x] 3.5 实现 MIME type 到扩展名转换

## 4. VFS Service Thumbnail 生成模块

- [x] 4.1 实现 image thumbnail 生成（使用 sharp）
- [x] 4.2 实现 video frame extraction（使用 ffmpeg）
- [x] 4.3 实现 thumbnail 缓存（workspace/thumbnails/）
- [x] 4.4 实现 getThumbnail API

## 5. VFS Service Native Messaging 协议处理

- [x] 5.1 实现 stdin/stdout JSON 协议（4-byte length prefix）
- [x] 5.2 实现 message dispatcher（根据 method 路由到对应 handler）
- [x] 5.3 实现 error response 格式化
- [x] 5.4 实现 workspace 配置加载（默认 ~/.vfs-workspace，支持 --workspace 参数）

## 6. VFS Service API 实现

- [x] 6.1 实现 saveFile API（hash, save blob, insert SQLite）
- [x] 6.2 实现 getFile API（read blob, query metadata）
- [x] 6.3 实现 deleteFile API（软删除/硬删除）
- [x] 6.4 实现 listFiles API（分页查询）
- [x] 6.5 实现 updateMetadata API（更新分类结果）
- [x] 6.6 实现 getMetadata API
- [x] 6.7 实现 getThumbnail API
- [x] 6.8 实现 getStats API
- [x] 6.9 实现 getWorkspaceConfig / setWorkspaceConfig API
- [x] 6.10 实现 enqueueClassification / getQueueStatus API

## 7. VFS Service 单元测试

- [x] 7.1 编写 SQLite module 测试（CRUD, query）
- [x] 7.2 编写 Blob storage 测试（save, read, delete, hash）
- [x] 7.3 编写 Native Messaging protocol 测试
- [x] 7.4 编写 API handler 测试（各 method）

## 8. Extension Native Messaging Client

- [x] 8.1 创建 extension/src/background/vfs-client.ts
- [x] 8.2 实现 connectNative 和 Port 管理
- [x] 8.3 实现 send/receive message（promise-based）
- [x] 8.4 实现 disconnect/reconnect 处理
- [x] 8.5 实现 error handling（host not found, crash）

## 9. Extension Background File Manager

- [x] 9.1 创建 extension/src/background/file-manager.ts
- [x] 9.2 实现 capture:media message handler（接收 Content Script 数据）
- [x] 9.3 实现 saveFile 流程（调用 VFS.saveFile, broadcast file:captured）
- [x] 9.4 实现 listFiles handler（响应 DevTools Panel 请求）
- [x] 9.5 实现 deleteFile handler（调用 VFS.deleteFile, broadcast）
- [x] 9.6 实现 thumbnail URL 管理（调用 VFS.getThumbnail, create blob URL）
- [x] 9.7 实现 event broadcasting（chrome.runtime.sendMessage to Panels）

## 10. Extension Background AI Classifier

- [x] 10.1 创建 extension/src/background/classify/scheduler.ts
- [x] 10.2 创建 extension/src/background/classify/ollama-client.ts
- [x] 10.3 实现 Ollama health check（启动时检测）
- [x] 10.4 实现 classify task processing（getFile → call Ollama → updateMetadata）
- [x] 10.5 实现 classification result parsing（pipe, space, JSON fallback）
- [x] 10.6 实现 queue scheduler（并发控制，pending → processing → completed）
- [x] 10.7 实现 retry failed tasks
- [x] 10.8 实现 enqueueClassification（capture 后自动入队）
- [x] 10.9 实现 prompt builder（支持 language, filenameStyle, filenameStylePrompt）

## 11. Extension Background Config Manager

- [x] 11.1 创建 extension/src/background/config-manager.ts
- [x] 11.2 实现 Ollama endpoint 配置（chrome.storage.local）
- [x] 11.3 实现 vision model 配置
- [x] 11.4 实现 classification concurrency 配置
- [x] 11.5 实现 language 和 filenameStyle 配置
- [x] 11.6 实现 config sync to DevTools Panel

## 12. Extension Content Script 修改

- [x] 12.1 修改 network listener（移除 WebSocket 依赖）
- [x] 12.2 实现 capture:media message 发送（chrome.runtime.sendMessage to Background）
- [x] 12.3 添加 maxFileSize 检查（跳过大文件）

## 13. Extension DevTools Panel 重构

- [x] 13.1 移除 useWebSocket hook
- [x] 13.2 创建 useBackgroundMessaging hook（chrome.runtime.onMessage）
- [x] 13.3 修改 useCombinedMedia hook（从 Background 获取数据）
- [x] 13.4 修改 useClassifyQueue hook（从 Background 获取队列状态）
- [x] 13.5 添加 Ollama status indicator（可用/不可用）
- [x] 13.6 添加 VFS connection status indicator
- [x] 13.7 实现配置面板（Ollama endpoint, model, style）

## 14. Extension manifest.json 更新

- [x] 14.1 添加 nativeMessaging 权限
- [x] 14.2 更新 background service worker 配置
- [x] 14.3 添加 allowed_origins for Native Messaging host

## 15. 移除 Proxy Server

- [x] 15.1 移除 packages/proxy 目录
- [x] 15.2 更新根 package.json（移除 proxy workspace）
- [x] 15.3 更新 pnpm-workspace.yaml

## 16. 移除 WebSocket 相关代码

- [x] 16.1 移除 extension/src/entrypoints/devtools-panel/hooks/useWebSocket.ts
- [x] 16.2 移除 useNetworkListener 的 WebSocket 依赖

## 17. 移除 Plugin System

- [x] 17.1 移除 proxy/plugins 目录
- [x] 17.2 移除 proxy/src/plugins 目录

## 18. ai-classify 包调整

- [x] 18.1 保留 CLI 模式作为独立工具（可选）
- [x] 18.2 classifier.ts 导出为共享模块（供 Extension 使用）
- [x] 18.3 更新 package.json exports

## 19. 安装脚本和文档

- [x] 19.1 创建 install-native-host.sh（macOS/Linux）
- [x] 19.2 创建 install-native-host.ps1（Windows）
- [x] 19.3 更新 README.md（架构说明、安装步骤）
- [x] 19.4 创建 ARCHITECTURE.md（详细架构文档）

## 20. 集成测试

- [x] 20.1 测试完整捕获流程（Network → Background → VFS）
- [x] 20.2 测试分类流程（VFS → Ollama → VFS metadata update）
- [x] 20.3 测试 DevTools Panel 显示（文件列表、缩略图、分类状态）
- [x] 20.4 测试 Native Messaging 连接（disconnect/reconnect）
- [x] 20.5 测试配置保存和加载