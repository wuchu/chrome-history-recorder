## Context

当前系统架构：

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  DevTools Panel  │────▶│ Background Worker│────▶│   VFS Service    │
│                  │     │                  │     │                  │
│ useHistorical    │     │ Message Handler  │     │  Dispatcher      │
│ Images.ts        │     │ (index.ts)       │     │                  │
│                  │     │                  │     │                  │
│ 发送消息:         │     │ 处理消息:        │     │ 处理方法:        │
│ 'list-files' ❌  │────▶│ 'listFiles' ✓    │────▶│ 'listFiles' ✓    │
│                  │     │                  │     │                  │
│ 参数:            │     │ 期望:            │     │                  │
│ {limit,offset,   │     │ message.query    │     │                  │
│  category} ❌    │     │ ✓                │     │                  │
│                  │     │                  │     │                  │
│ 响应处理:        │     │ 返回:            │     │                  │
│ response.error ❌│◀────│ {success, data} ✓│◀────│                  │
│                  │     │                  │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

**现状**：
- DevTools Panel 发送的消息类型与 Background Worker 不匹配
- WebSocket 和 Ollama 服务状态在界面显示，但缺少主动健康检查和用户引导
- 服务未连接时，用户只能看到静态状态文本，无法了解如何解决

## Goals / Non-Goals

**Goals**：
- 修复消息类型不匹配，使历史图片加载功能正常工作
- 增强服务健康监控，提供主动检测和状态上报
- 改进用户体验，当服务未连接时提供明确指引和重试选项

**Non-Goals**：
- 不重构整个消息系统架构（保持现有 Chrome Extension 消息机制）
- 不修改 VFS Service 或 Ollama 服务端实现
- 不添加自动启动服务功能（保持手动启动模式）

## Decisions

### 1. 消息类型统一方案

**决策**：修改 DevTools Panel 的消息发送逻辑，统一使用 camelCase

**原因**：
- Background Worker 和 VFS Service 已使用 camelCase
- 修改发送方代码改动最小，仅影响 `useHistoricalImages.ts`
- 向后兼容性好，不影响其他消息处理

**替代方案考虑**：
- 方案 A：在 Background Worker 添加 `list-files` 处理 → 需要维护两种消息类型，增加复杂度
- 方案 B：创建消息协议定义文件 → 需要重构多个文件，改动范围大

### 2. 服务健康监控方案

**决策**：在 Background Worker 初始化时添加健康检查回调

**实现**：
- WebSocket 客户端：在连接状态变化时，主动广播 `vfs:connected` / `vfs:disconnected` 事件
- Ollama 客户端：定期（每 30 秒）检查健康状态，广播 `ollama:status` 事件
- DevTools Panel：监听事件并显示状态，提供重试按钮

**原因**：
- 已有事件广播机制，只需增强状态检测频率
- 用户可以实时了解服务状态变化
- 提供手动重试选项，避免无限自动重连造成的资源浪费

### 3. 错误提示改进方案

**决策**：在状态显示区域添加可点击的详情和操作

**实现**：
- WebSocket 未连接：显示 "VFS 未连接"，点击显示 "请确保 VFS Service 已启动（pnpm vfs:start）"
- Ollama 未运行：显示 "Ollama 未运行"，点击显示 "请启动 Ollama 服务（ollama serve）"

**原因**：
- 用户往往不知道如何启动这些服务
- 提供明确的命令指引，降低使用门槛

## Risks / Trade-offs

### Risk 1: 消息类型修改可能影响其他调用方

**风险**：如果其他代码也使用 `list-files` 消息类型，修改会导致兼容性问题

**缓解**：
- 在修改前使用 `grep` 搜索所有使用 `list-files` 的代码
- 如果发现其他调用方，同步修改或使用方案 B（双消息类型支持）

### Risk 2: 健康检查频率可能影响性能

**风险**：定期健康检查可能增加系统负载

**缓解**：
- Ollama 健康检查间隔设置为 30 秒，避免频繁请求
- WebSocket 使用被动检测（连接状态变化时触发），避免主动轮询

### Trade-off: 不添加自动启动服务

**权衡**：用户仍需手动启动 VFS Service 和 Ollama

**原因**：
- 自动启动涉及进程管理，增加系统复杂度
- 用户可能在不同环境使用不同配置，手动启动更灵活
- 未来可作为独立功能迭代