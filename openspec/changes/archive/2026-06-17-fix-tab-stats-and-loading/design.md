## Context

当前存在两个问题：
1. Tab 上的统计数字一直显示为零
2. 切换 Tab 时，媒体资源一直处于 loading 状态

根本原因分析：
- **问题 1**：VFS 服务的 `dist/dispatcher.js` 编译代码中缺少 `getTagCounts` 路由，导致 WebSocket 返回 "Unknown method: getTagCounts" 错误
- **问题 2**：`fileManager.handleListFiles` 方法和 Background 的 `listFiles` handler 都缺少对 `tag` 参数的支持，导致切换 Tab 时无法正确过滤媒体

## Goals / Non-Goals

**Goals:**
- 修复 Tab 统计数字显示为零的问题
- 修复切换 Tab 时媒体一直 loading 的问题
- 确保 `clearIndex` 和 `getTagCounts` 都在 VFS 服务中正常工作

**Non-Goals:**
- 不修改现有的数据模型
- 不添加新功能，只修复现有问题

## Decisions

### Decision 1：重新编译 VFS 服务
- **选择**：运行 `npm run build` 重新编译 `packages/vfs-service`
- **原因**：源码中 `dispatcher.ts` 和 `api.ts` 都有 `getTagCounts` 和 `clearIndex`，但编译后的代码中缺失，说明需要重新编译
- **替代方案**：手动修改编译后的代码（不推荐，容易出错）

### Decision 2：修复 fileManager.handleListFiles
- **选择**：在 `fileManager.handleListFiles` 的类型定义和实现中添加 `tag` 参数
- **原因**：需要将 `tag` 参数传递给 VFS WebSocket Client
- **替代方案**：直接调用 `vfsWsClient.listFiles` 而不通过 fileManager（不推荐，破坏架构）

### Decision 3：修复 Background 的 listFiles handler
- **选择**：在 Background 的 `listFiles` handler 中提取并传递 `tag` 参数
- **原因**：确保从 UI 传递的 `tag` 参数能够到达 VFS 服务
- **替代方案**：修改整个消息协议（不推荐，影响范围太大）

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| 重新编译可能引入其他问题 | 中 | 重新编译后运行测试验证 |
| tag 参数的传递可能影响其他功能 | 低 | 只在需要时传递 tag，不传时保持默认行为 |
| VFS 服务重启可能导致连接断开 | 低 | 提醒用户重启 VFS 服务 |
