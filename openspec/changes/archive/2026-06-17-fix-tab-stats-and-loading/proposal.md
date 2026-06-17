## Why

用户反馈了两个问题：
1. Tab 上的统计数字一直显示为零
2. 切换 Tab 时，媒体资源一直处于 loading 状态

这些问题影响用户体验，需要立即修复。

## What Changes

- **修复 VFS 服务编译问题**：确保 `getTagCounts` 和 `clearIndex` 路由在编译后的代码中存在
- **修复 fileManager.handleListFiles**：添加 `tag` 参数支持
- **修复 Background 的 listFiles handler**：提取并传递 `tag` 参数给 VFS 服务

## Capabilities

### New Capabilities

### Modified Capabilities
- `vfs-service`: 确保所有 API 路由在编译后都存在
- `extension-file-manager`: 支持 tag 参数的文件列表查询
- `message-protocol-unification`: 确保 tag 参数在消息传递中正确传递

## Impact

- **代码**：`packages/vfs-service/` (需要重新编译)，`packages/extension/src/background/`
- **API**：WebSocket 消息协议（确保 getTagCounts 路由存在）
- **用户体验**：Tab 统计显示正确，切换 Tab 时媒体正常加载
