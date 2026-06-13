## 1. 修复消息协议问题

- [x] 1.1 搜索代码库，确认所有使用 'list-files' 的位置
- [x] 1.2 修改 useHistoricalImages.ts，将消息类型从 'list-files' 改为 'listFiles'
- [x] 1.3 修改 useHistoricalImages.ts，将参数包装为 query 对象 `{ query: { limit, offset, category } }`
- [x] 1.4 修改 useHistoricalImages.ts，正确处理 `{ success, data }` 格式的响应
- [x] 1.5 修改 useHistoricalImages.ts，正确处理 `{ success: false, error }` 错误响应
- [x] 1.6 测试历史图片加载功能，确认消息发送和响应处理正确

## 2. 增强 WebSocket 连接状态检测

- [x] 2.1 在 vfs-ws-client.ts 中，确保 handleConnect 和 handleDisconnect 回调正确触发
- [x] 2.2 在 vfs-ws-client.ts 中，添加连接状态变化的日志记录
- [x] 2.3 在 file-manager.ts 中，确保 broadcastEvent 正确广播 'vfs:connected' 和 'vfs:disconnected' 事件
- [x] 2.4 测试 WebSocket 连接和断开场景，确认事件广播正确

## 3. 增强 Ollama 服务健康检查

- [x] 3.1 在 ollama-client.ts 中，添加定期健康检查逻辑（30 秒间隔）
- [x] 3.2 在 ollama-client.ts 中，确保状态变化时触发 onStatus 回调
- [x] 3.3 在 background/index.ts 中，确保正确设置 onStatus 回调并广播 'ollama:status' 事件
- [x] 3.4 测试 Ollama 健康检查，确认状态变化时事件广播正确

## 4. 改进 Background Worker 状态上报

- [x] 4.1 在 background/index.ts 中，确保初始化时正确广播 VFS 和 Ollama 初始状态
- [x] 4.2 在 background/index.ts 中，确保 WebSocket 连接超时时广播 'vfs:disconnected' 事件
- [x] 4.3 在 background/index.ts 中，添加 isVFSConnected 和 isOllamaAvailable 消息处理（如果缺失）
- [x] 4.4 测试 Background Worker 初始化流程，确认状态上报正确

## 5. 改进 DevTools Panel 状态显示

- [x] 5.1 在 DevTools Panel 中，添加监听 'vfs:connected' 和 'vfs:disconnected' 事件的逻辑
- [x] 5.2 在 DevTools Panel 中，添加监听 'ollama:status' 事件的逻辑
- [x] 5.3 在 DevTools Panel 状态栏中，显示 VFS 和 Ollama 服务状态（使用图标和颜色区分）
- [x] 5.4 在 DevTools Panel 中，添加服务未连接时的用户指引（显示启动命令）
- [x] 5.5 在 DevTools Panel 中，添加手动重试连接按钮
- [x] 5.6 测试 DevTools Panel 状态显示，确认实时更新和用户指引正确

## 6. 综合测试

- [ ] 6.1 测试 VFS Service 未启动场景，确认 DevTools Panel 显示正确提示
- [ ] 6.2 测试 Ollama 未运行场景，确认 DevTools Panel 显示正确提示
- [x] 6.3 测试 VFS Service 启动后自动连接场景，确认状态正确更新
- [x] 6.4 测试 Ollama 启动后状态检测场景，确认状态正确更新
- [ ] 6.5 测试历史图片加载功能，确认在各种服务状态下行为正确
- [ ] 6.6 测试手动重试连接功能，确认用户可以主动触发重新连接