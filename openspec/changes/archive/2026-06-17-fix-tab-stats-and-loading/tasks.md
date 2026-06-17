## 1. 修复 VFS 服务编译问题

- [x] 1.1 确认源码中 dispatcher.ts 包含 getTagCounts 和 clearIndex 路由
- [x] 1.2 确认源码中 api.ts 包含 getTagCounts 和 clearIndex 方法
- [x] 1.3 在 packages/vfs-service/ 中运行 npm run build 重新编译
- [x] 1.4 验证编译后的 dist/dispatcher.js 包含 getTagCounts 和 clearIndex 路由
- [x] 1.5 验证编译后的 dist/api.js 包含 getTagCounts 和 clearIndex 方法

## 2. 修复 fileManager.handleListFiles

- [x] 2.1 在 file-manager.ts 中更新 handleListFiles 类型定义，添加 tag 参数
- [x] 2.2 在 file-manager.ts 中更新 handleListFiles 实现，传递 tag 参数给 vfsWsClient.listFiles

## 3. 修复 Background 的 listFiles handler

- [x] 3.1 在 background/index.ts 中更新 listFiles handler，从 message.query 中提取 tag 参数
- [x] 3.2 在 background/index.ts 中将 tag 参数传递给 fileManager.handleListFiles

## 4. 测试验证

- [x] 4.1 重启 VFS 服务
- [x] 4.2 验证 Tab 统计数字显示正确
- [x] 4.3 验证切换 Tab 时媒体正常加载
- [x] 4.4 验证 clearIndex 功能正常
